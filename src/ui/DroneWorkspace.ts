import type { RoofObstruction } from '../model/types.ts'
import { applyHomography, calculateHomography, invertHomography, roofMetricCorners, type Homography, type Point2 } from '../model/homography.ts'
import { DRONE_DIMENSIONS, OBJECT_CORNER_LABELS, ROOF_CORNER_LABELS, measureDroneObject, planBounds, type DroneObjectResult } from '../model/droneMeasurement.ts'

type Target={kind:'roof';index:number}|{kind:'object';objectId:string;index:number}

export class DroneWorkspace{
  private image:HTMLImageElement|null=null
  private sourceUrl:string|null=null
  private roofPoints:(Point2|null)[]=[null,null,null,null]
  private objectPoints:Record<string,(Point2|null)[]>
  private target:Target={kind:'roof',index:0}
  private dimensions=DRONE_DIMENSIONS[0]!
  private homography:Homography|null=null
  private rectifiedImage:ImageData|null=null
  private rectifiedImageKey=''
  private message='Vier Dachecken in der angegebenen Reihenfolge setzen.'
  private readonly sourceCanvas:HTMLCanvasElement
  private readonly rectifiedCanvas:HTMLCanvasElement

  constructor(private readonly host:HTMLElement,private readonly obstructions:RoofObstruction[],private readonly onClose:()=>void){
    this.objectPoints=Object.fromEntries(obstructions.map(o=>[o.id,[null,null,null,null]]))
    host.innerHTML=`<div class="drone-controls">
      <div class="drone-heading"><h2>Dachvermessung</h2><button id="drone-close">Zurück zur iPhone-Kalibrierung</button></div>
      <p class="hint warning-note">Die eingezeichneten PV-Module sind eine nachträgliche Planung und dürfen nicht vermessen werden.</p>
      <label class="file-button">Drohnenaufnahme auswählen<input id="drone-photo" type="file" accept="image/*"></label>
      <label class="single-input"><span>Dachmaße</span><select id="drone-dimensions"></select></label>
      <p id="dimension-difference" class="hint"></p>
      <label class="single-input"><span>Messziel</span><select id="drone-target-kind"><option value="roof">Dachreferenz</option>${obstructions.map(o=>`<option value="${o.id}">${o.name}</option>`).join('')}</select></label>
      <label class="single-input"><span>Ecke</span><select id="drone-target-corner"></select></label>
      <p class="hint">Dachreihenfolge: Traufe links → Traufe rechts → First rechts → First links. Alle Punkte können durch Auswahl und erneuten Klick korrigiert werden.</p>
      <div class="button-grid"><button id="drone-clear-target">Gewählte Punkte löschen</button><button id="drone-clear-all">Alles löschen</button></div>
      <label class="single-input"><span>Klickunsicherheit</span><span><input id="drone-uncertainty" type="number" min="0.5" max="30" step="0.5" value="3"><i>px</i></span></label>
      <label class="slider-row"><span>Darstellung</span><input id="drone-scale" type="range" min="40" max="130" step="5" value="80"><output id="drone-scale-value">80 px/m</output></label>
      <p id="drone-status" class="hint" role="status"></p>
      <button id="export-drone" disabled>Messung als JSON exportieren</button>
      <div id="drone-comparison"></div>
      <div id="drone-diagnosis" class="hint"></div>
    </div><div class="drone-content">
      <figure><figcaption>Drohnenaufnahme – Punkte anklicken</figcaption><canvas id="drone-source"></canvas></figure>
      <figure><figcaption>Entzerrte Dachfläche – X entlang Traufe, Y Traufe → First</figcaption><canvas id="drone-rectified"></canvas></figure>
    </div>`
    this.sourceCanvas=this.element('drone-source');this.rectifiedCanvas=this.element('drone-rectified')
    const dimensions=this.element<HTMLSelectElement>('drone-dimensions')
    dimensions.replaceChildren(...DRONE_DIMENSIONS.map(d=>new Option(d.label,d.id)))
    this.bind();this.updateCornerOptions();this.updateDimensionText();this.render()
  }

  private element<T extends HTMLElement>(id:string):T{return this.host.querySelector<T>(`#${id}`)!}
  private bind():void{
    this.element('drone-close').addEventListener('click',this.onClose)
    this.element<HTMLInputElement>('drone-photo').addEventListener('change',event=>{const file=(event.target as HTMLInputElement).files?.[0];if(file)this.loadPhoto(file)})
    this.element<HTMLSelectElement>('drone-dimensions').addEventListener('change',event=>{this.dimensions=DRONE_DIMENSIONS.find(d=>d.id===(event.target as HTMLSelectElement).value)!;this.rectifiedImageKey='';this.updateDimensionText();this.calculate();this.render()})
    this.element<HTMLSelectElement>('drone-target-kind').addEventListener('change',()=>{this.updateCornerOptions();this.render()})
    this.element<HTMLSelectElement>('drone-target-corner').addEventListener('change',()=>this.updateTarget())
    this.element('drone-clear-target').addEventListener('click',()=>{if(this.target.kind==='roof'){this.roofPoints=[null,null,null,null];this.rectifiedImageKey=''}else this.objectPoints[this.target.objectId]=[null,null,null,null];this.calculate();this.render()})
    this.element('drone-clear-all').addEventListener('click',()=>{this.roofPoints=[null,null,null,null];this.rectifiedImageKey='';for(const id of Object.keys(this.objectPoints))this.objectPoints[id]=[null,null,null,null];this.calculate();this.render()})
    this.element<HTMLInputElement>('drone-scale').addEventListener('input',event=>{this.rectifiedImageKey='';this.element<HTMLOutputElement>('drone-scale-value').value=`${(event.target as HTMLInputElement).value} px/m`;this.renderRectified()})
    this.element<HTMLInputElement>('drone-uncertainty').addEventListener('change',()=>{this.calculate();this.render()})
    this.sourceCanvas.addEventListener('click',event=>this.placePoint(event))
    this.element('export-drone').addEventListener('click',()=>this.exportJson())
  }
  private loadPhoto(file:File):void{
    if(this.sourceUrl)URL.revokeObjectURL(this.sourceUrl)
    this.sourceUrl=URL.createObjectURL(file);const image=new Image()
    image.onload=()=>{this.image=image;this.rectifiedImageKey='';this.message=`${file.name} · ${image.naturalWidth} × ${image.naturalHeight} px`;this.render()}
    image.onerror=()=>{this.message='Drohnenaufnahme konnte nicht gelesen werden.';this.render()};image.src=this.sourceUrl
  }
  private updateDimensionText():void{
    this.element('dimension-difference').textContent=`Vergleich zum bisherigen Modell: Trauflänge ${(this.dimensions.length-10.73>=0?'+':'')+((this.dimensions.length-10.73)*100).toFixed(0)} cm, Dachschräge ${(this.dimensions.slope-6.29>=0?'+':'')+((this.dimensions.slope-6.29)*100).toFixed(0)} cm. Die Auswahl ändert das Hausmodell nicht.`
  }
  private updateCornerOptions():void{
    const kind=this.element<HTMLSelectElement>('drone-target-kind').value
    const corner=this.element<HTMLSelectElement>('drone-target-corner'),labels=kind==='roof'?ROOF_CORNER_LABELS:OBJECT_CORNER_LABELS
    corner.replaceChildren(...labels.map((label,index)=>new Option(`${index+1}. ${label}`,String(index))))
    this.updateTarget()
  }
  private updateTarget():void{
    const kind=this.element<HTMLSelectElement>('drone-target-kind').value,index=Number(this.element<HTMLSelectElement>('drone-target-corner').value)
    this.target=kind==='roof'?{kind:'roof',index}:{kind:'object',objectId:kind,index}
  }
  private placePoint(event:MouseEvent):void{
    if(!this.image)return
    const rect=this.sourceCanvas.getBoundingClientRect(),point={x:(event.clientX-rect.left)/rect.width*this.image.naturalWidth,y:(event.clientY-rect.top)/rect.height*this.image.naturalHeight}
    if(this.target.kind==='roof'){this.roofPoints[this.target.index]=point;this.rectifiedImageKey=''}
    else this.objectPoints[this.target.objectId]![this.target.index]=point
    const corner=this.element<HTMLSelectElement>('drone-target-corner')
    if(Number(corner.value)<3){corner.value=String(Number(corner.value)+1);this.updateTarget()}
    this.calculate();this.render()
  }
  private calculate():void{
    this.homography=null
    if(this.roofPoints.every((p):p is Point2=>p!==null))try{
      this.homography=calculateHomography(this.roofPoints,roofMetricCorners(this.dimensions.length,this.dimensions.slope));this.message='Dachentzerrung gültig.'
    }catch(error){this.message=error instanceof Error?error.message:'Dachentzerrung fehlgeschlagen.'}
  }
  private results():DroneObjectResult[]{
    if(!this.homography||!this.roofPoints.every((p):p is Point2=>p!==null))return []
    const uncertainty=Number(this.element<HTMLInputElement>('drone-uncertainty').value)
    return this.obstructions.flatMap(o=>{
      const points=this.objectPoints[o.id]!
      if(!points.every((p):p is Point2=>p!==null))return []
      return [measureDroneObject(this.homography!,this.roofPoints as Point2[],points,this.dimensions,o,uncertainty)]
    })
  }
  private render():void{this.renderSource();this.renderRectified();this.renderComparison();this.element('drone-status').textContent=this.message}
  private renderSource():void{
    const canvas=this.sourceCanvas,context=canvas.getContext('2d')!,maxWidth=1200,maxHeight=720
    if(!this.image){canvas.width=900;canvas.height=560;context.fillStyle='#182026';context.fillRect(0,0,canvas.width,canvas.height);context.fillStyle='#aeb8bf';context.fillText('Drohnenaufnahme auswählen',30,40);return}
    const scale=Math.min(maxWidth/this.image.naturalWidth,maxHeight/this.image.naturalHeight,1);canvas.width=Math.round(this.image.naturalWidth*scale);canvas.height=Math.round(this.image.naturalHeight*scale);context.drawImage(this.image,0,0,canvas.width,canvas.height)
    const draw=(points:(Point2|null)[],color:string,label:string)=>points.forEach((p,index)=>{if(!p)return;const x=p.x*scale,y=p.y*scale;context.strokeStyle='white';context.lineWidth=4;context.beginPath();context.arc(x,y,8,0,Math.PI*2);context.stroke();context.strokeStyle=color;context.lineWidth=2;context.stroke();context.fillStyle=color;context.font='bold 14px system-ui';context.fillText(`${label}${index+1}`,x+11,y-10)})
    draw(this.roofPoints,'#ff453a','D')
    const colors=['#c77dff','#ffd43b','#29edff'];this.obstructions.forEach((o,index)=>draw(this.objectPoints[o.id]!,colors[index]!,`${o.name.slice(0,1)} `))
  }
  private renderRectified():void{
    const canvas=this.rectifiedCanvas,context=canvas.getContext('2d')!,pixelsPerMeter=Number(this.element<HTMLInputElement>('drone-scale').value)
    canvas.width=Math.round(this.dimensions.length*pixelsPerMeter);canvas.height=Math.round(this.dimensions.slope*pixelsPerMeter)
    context.fillStyle='#182026';context.fillRect(0,0,canvas.width,canvas.height)
    if(this.image&&this.homography){
      const key=`${canvas.width}x${canvas.height}:${this.roofPoints.map(p=>p?`${p.x},${p.y}`:'-').join(';')}`
      if(key!==this.rectifiedImageKey){
        const source=document.createElement('canvas');source.width=this.image.naturalWidth;source.height=this.image.naturalHeight;const sourceContext=source.getContext('2d')!;sourceContext.drawImage(this.image,0,0);const input=sourceContext.getImageData(0,0,source.width,source.height),output=context.createImageData(canvas.width,canvas.height),inverse=invertHomography(this.homography)
        for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
          const p=applyHomography(inverse,{x:x/pixelsPerMeter,y:this.dimensions.slope-y/pixelsPerMeter}),sx=Math.round(p.x),sy=Math.round(p.y),target=(y*canvas.width+x)*4
          if(sx>=0&&sx<source.width&&sy>=0&&sy<source.height){const origin=(sy*source.width+sx)*4;output.data[target]=input.data[origin]!;output.data[target+1]=input.data[origin+1]!;output.data[target+2]=input.data[origin+2]!;output.data[target+3]=255}
        }
        this.rectifiedImage=output;this.rectifiedImageKey=key
      }
      if(this.rectifiedImage)context.putImageData(this.rectifiedImage,0,0)
    }
    context.strokeStyle='#ffffff55';context.lineWidth=1;context.font='12px system-ui';context.fillStyle='white'
    for(let meter=0;meter<=Math.floor(this.dimensions.length);meter++){const x=meter*pixelsPerMeter;context.beginPath();context.moveTo(x,0);context.lineTo(x,canvas.height);context.stroke();context.fillText(`${meter} m`,x+3,canvas.height-5)}
    for(let meter=0;meter<=Math.floor(this.dimensions.slope);meter++){const y=canvas.height-meter*pixelsPerMeter;context.beginPath();context.moveTo(0,y);context.lineTo(canvas.width,y);context.stroke();context.fillText(`${meter} m`,3,y-4)}
    if(this.homography){const colors=['#c77dff','#ffd43b','#29edff'];this.obstructions.forEach((o,index)=>{
      const plan=planBounds(o);context.save();context.setLineDash([7,5]);context.strokeStyle=colors[index]!;context.lineWidth=2;context.strokeRect(plan.xMin*pixelsPerMeter,canvas.height-plan.yMax*pixelsPerMeter,plan.width*pixelsPerMeter,plan.length*pixelsPerMeter);context.restore()
      const points=this.objectPoints[o.id]!.filter((p):p is Point2=>p!==null).map(p=>applyHomography(this.homography!,p));context.strokeStyle=colors[index]!;context.fillStyle=colors[index]!;context.lineWidth=3;context.beginPath();points.forEach((p,i)=>{const x=p.x*pixelsPerMeter,y=canvas.height-p.y*pixelsPerMeter;i?context.lineTo(x,y):context.moveTo(x,y)});if(points.length===4)context.closePath();context.stroke();points.forEach(p=>{context.beginPath();context.arc(p.x*pixelsPerMeter,canvas.height-p.y*pixelsPerMeter,5,0,Math.PI*2);context.fill()})
    });context.fillStyle='white';context.fillText('durchgezogen: Messung · gestrichelt: PV-Plan',canvas.width-300,18)}
  }
  private renderComparison():void{
    const host=this.element('drone-comparison'),results=this.results();host.replaceChildren();this.element<HTMLButtonElement>('export-drone').disabled=!this.homography
    const diagnosis=this.element('drone-diagnosis');diagnosis.replaceChildren()
    if(!results.length){const p=document.createElement('p');p.className='hint';p.textContent=this.homography?'Je Objekt vier Anschluss-/Rahmenecken setzen. Gestrichelte Rechtecke zeigen bereits den PV-Plan.':'Zuerst vier gültige Dachpunkte setzen.';host.append(p);return}
    const table=document.createElement('table');table.className='drone-table';table.innerHTML='<thead><tr><th>Objekt</th><th>Messung [m]</th><th>PV-Plan [m]</th><th>Δ Grenzen [cm]</th><th>Δ Mittelpunkt [cm]</th><th>Δ Größe [cm]</th><th>Unsicherheit</th></tr></thead><tbody></tbody>'
    const body=table.querySelector('tbody')!
    for(const r of results){const row=document.createElement('tr');row.innerHTML=`<td>${r.name}</td><td>X ${r.measured.xMin.toFixed(3)}…${r.measured.xMax.toFixed(3)}<br>Y ${r.measured.yMin.toFixed(3)}…${r.measured.yMax.toFixed(3)}</td><td>X ${r.plan.xMin.toFixed(3)}…${r.plan.xMax.toFixed(3)}<br>Y ${r.plan.yMin.toFixed(3)}…${r.plan.yMax.toFixed(3)}</td><td>X ${r.differencesCm.xMin.toFixed(1)} / ${r.differencesCm.xMax.toFixed(1)}<br>Y ${r.differencesCm.yMin.toFixed(1)} / ${r.differencesCm.yMax.toFixed(1)}</td><td>X ${r.differencesCm.centerX.toFixed(1)}<br>Y ${r.differencesCm.centerY.toFixed(1)}</td><td>B ${r.differencesCm.width.toFixed(1)}<br>L ${r.differencesCm.length.toFixed(1)}</td><td>ca. ±${r.uncertaintyCm.toFixed(1)} cm*</td>`;body.append(row)}
    host.append(table);const caution=document.createElement('p');caution.className='hint warning-note';caution.textContent='* Schätzung aus Klickunsicherheit und Störung der Dachreferenzpunkte. Sichtbare Kamin-/Rahmenkanten oberhalb der Dachebene erzeugen zusätzlich einen nicht bezifferten systematischen Perspektivfehler. Möglichst Dachanschluss bzw. Schnittkante markieren.';host.append(caution)
    const south=results.find(r=>r.objectId==='east-04'),others=results.filter(r=>r.objectId!=='east-04')
    const magnitude=(r:DroneObjectResult)=>Math.hypot(r.differencesCm.centerX,r.differencesCm.centerY)
    const p=document.createElement('p')
    const common=others.length?{x:others.reduce((sum,r)=>sum+r.differencesCm.centerX,0)/others.length,y:others.reduce((sum,r)=>sum+r.differencesCm.centerY,0)/others.length}:null
    const southRelative=south&&common?Math.hypot(south.differencesCm.centerX-common.x,south.differencesCm.centerY-common.y):0
    const combinedUncertainty=south&&others.length?south.uncertaintyCm+Math.max(...others.map(r=>r.uncertaintyCm)):Infinity
    if(south&&common&&southRelative>2*combinedUncertainty)p.textContent=`Diagnosehinweis: Gegenüber dem mittleren globalen Versatz von Kamin und Badfenster hat das Südzimmerfenster eine zusätzliche Mittelpunktabweichung von ${southRelative.toFixed(1)} cm. Das stützt Hypothese A (lokale Plan-/Objektabweichung), beweist sie wegen möglicher Höhen-, Kanten- und Referenzpunktfehler aber nicht.`
    else if(results.length===3&&results.every(r=>magnitude(r)>2*r.uncertaintyCm))p.textContent='Diagnosehinweis: Alle drei Objekte zeigen relevante Abweichungen. Ein globaler Bezug-, Maß- oder Referenzpunktfehler (Hypothese B beziehungsweise Dachentzerrung) sollte vor einer lokalen Planänderung geprüft werden.'
    else p.textContent='Diagnosehinweis: Die Messung trennt die Hypothesen noch nicht eindeutig. Einzelabweichungen, Unsicherheiten und die unabhängigen iPhone-Residuen gemeinsam beurteilen. Die synthetischen Tests der WebApp zeigen derzeit keinen Achsen-, Vorzeichen- oder Doppelkorrekturfehler (Hypothese C).'
    diagnosis.append(p)
  }
  private exportJson():void{
    const payload={version:1,createdAt:new Date().toISOString(),coordinateConvention:{x:'entlang Traufe von links',y:'auf Dachfläche von Traufe zu First',unit:'m'},warning:'PV-Module sind Planungszeichnung und wurden nicht vermessen.',dimensions:this.dimensions,dimensionComparisonCm:{length:(this.dimensions.length-10.73)*100,slope:(this.dimensions.slope-6.29)*100},roofImagePoints:this.roofPoints,objects:this.results(),pixelUncertainty:Number(this.element<HTMLInputElement>('drone-uncertainty').value)}
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='pv-shadowlab-drohnenvermessung.json';link.click();URL.revokeObjectURL(url)
  }
}
