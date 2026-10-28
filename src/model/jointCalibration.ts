import type { AppConfig } from './types.ts'
import { referencePoints, projectPoint } from './calibration.ts'
import { calculateChimney } from './geometry.ts'
import { getParameter, parameterSpecs, setParameter } from './parameters.ts'

export interface PointError {
  pointId:string; label:string; objectId:string; active:boolean; weight:number
  measured:{x:number;y:number}; projected:{x:number;y:number}|null
  dx:number; dy:number; errorPx:number; robustWeight:number
}
export interface CalibrationDiagnostics {
  points:PointError[]; activeCount:number; rmsPx:number; maxPx:number; warnings:string[]
}
export interface JointResult extends CalibrationDiagnostics {
  config:AppConfig; accepted:boolean; status:string; iterations:number; rank:number; parameterCount:number; condition:number
}

/** Residuals use original image pixels, independently of viewport size or zoom. */
export function calibrationDiagnostics(config:AppConfig):CalibrationDiagnostics{
  const refs=new Map(referencePoints(config).map(p=>[p.id,p]))
  const {imageWidth:w,imageHeight:h,robustThresholdPx:delta}=config.calibration
  const points=config.calibration.observations.map(o=>{
    const ref=refs.get(o.pointId),p=ref?projectPoint(ref.point,config.house.orientationDeg,config.photoCamera):null
    const dx=p?(p.x-o.x)*w/2:Infinity,dy=p?(p.y-o.y)*h/2:Infinity,errorPx=Math.hypot(dx,dy)
    return {pointId:o.pointId,label:ref?`${ref.objectName}: ${ref.label}`:o.pointId,objectId:ref?.objectId??'unknown',active:o.active,weight:o.weight,measured:{x:o.x,y:o.y},projected:p,dx,dy,errorPx,robustWeight:Math.min(1,delta/Math.max(errorPx,1e-12))}
  })
  const active=points.filter(p=>p.active&&p.weight>0),warnings:string[]=[]
  const rmsPx=active.length?Math.sqrt(active.reduce((s,p)=>s+p.errorPx**2,0)/active.length):0
  const maxPx=active.length?Math.max(...active.map(p=>p.errorPx)):0
  if(active.some(p=>!p.projected))warnings.push('Mindestens ein aktiver Modellpunkt liegt hinter der Kamera oder ist nicht zugeordnet.')
  for(const o of config.roofObstructions.filter(o=>o.kind==='chimney')){
    const {base}=calculateChimney(config.house,o,config.calibration.chimneyTopY,config.calibration.corrections[o.id])
    if(Math.max(...base.map(p=>p.y))>=config.calibration.chimneyTopY)warnings.push('Kaminoberkante liegt nicht vollständig über dem Dachanschluss. Absolute Y-Höhe prüfen.')
  }
  if(active.length && active.some(p=>p.errorPx>delta*3))warnings.push('Große Einzelabweichungen werden robust geringer gewichtet. Punktzuordnung und Objektgeometrie prüfen.')
  const objects=new Map<string,PointError[]>()
  active.forEach(p=>objects.set(p.objectId,[...(objects.get(p.objectId)??[]),p]))
  if(objects.size>1){
    const means=[...objects].map(([id,ps])=>({id,mean:ps.reduce((s,p)=>s+p.errorPx,0)/ps.length}))
    const sorted=means.sort((a,b)=>b.mean-a.mean)
    if(sorted[0]!.mean>Math.max(delta*2,sorted[1]!.mean*2))warnings.push(`Die Abweichungen konzentrieren sich auf ${active.find(p=>p.objectId===sorted[0]!.id)!.label.split(':')[0]}. Dies allein belegt keine konkrete Ursache.`)
  }
  if(active.length>=6){
    const correlation=(a:number[],b:number[])=>{const ma=a.reduce((s,v)=>s+v,0)/a.length,mb=b.reduce((s,v)=>s+v,0)/b.length;return a.reduce((s,v,i)=>s+(v-ma)*(b[i]!-mb),0)/Math.sqrt(a.reduce((s,v)=>s+(v-ma)**2,0)*b.reduce((s,v)=>s+(v-mb)**2,0))}
    const meanError=active.reduce((s,p)=>s+p.errorPx,0)/active.length
    if(meanError>delta&&correlation(active.map(p=>Math.hypot(p.measured.x,p.measured.y)),active.map(p=>p.errorPx))>.65)warnings.push('Größere Fehler zum Bildrand hin erkennbar. FOV, Bildausschnitt und Punktzuordnungen prüfen; Verzeichnung wird nicht automatisch angenommen.')
    const meanVector=Math.hypot(active.reduce((s,p)=>s+p.dx,0),active.reduce((s,p)=>s+p.dy,0))/active.length
    if(meanError>delta&&meanVector>.75*meanError)warnings.push('Die Restfehler zeigen überwiegend eine gemeinsame Bildrichtung. Eine globale Abweichung ist möglich.')
  }
  return {points,activeCount:active.length,rmsPx,maxPx,warnings}
}

function solve(a:number[][],b:number[]):number[]|null{
  const n=b.length,m=a.map((row,i)=>[...row,b[i]!])
  for(let k=0;k<n;k++){
    let pivot=k
    for(let i=k+1;i<n;i++)if(Math.abs(m[i]![k]!)>Math.abs(m[pivot]![k]!))pivot=i
    if(Math.abs(m[pivot]![k]!)<1e-14)return null
    ;[m[k],m[pivot]]=[m[pivot]!,m[k]!]
    const d=m[k]![k]!
    for(let j=k;j<=n;j++)m[k]![j]!/=d
    for(let i=0;i<n;i++)if(i!==k){const f=m[i]![k]!;for(let j=k;j<=n;j++)m[i]![j]!-=f*m[k]![j]!}
  }
  return m.map(row=>row[n]!)
}

/** Eigenvalues of symmetric normalized information matrix (Jacobi rotations). */
function eigenvalues(matrix:number[][]):number[]{
  const a=matrix.map(row=>[...row]),n=a.length
  for(let iteration=0;iteration<100*n*n;iteration++){
    let p=0,q=0,largest=0
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(Math.abs(a[i]![j]!)>largest){largest=Math.abs(a[i]![j]!);p=i;q=j}
    if(largest<1e-12)break
    const angle=.5*Math.atan2(2*a[p]![q]!,a[q]![q]!-a[p]![p]!),c=Math.cos(angle),s=Math.sin(angle)
    const pp=a[p]![p]!,qq=a[q]![q]!,pq=a[p]![q]!
    for(let k=0;k<n;k++)if(k!==p&&k!==q){const kp=a[k]![p]!,kq=a[k]![q]!;a[k]![p]=a[p]![k]=c*kp-s*kq;a[k]![q]=a[q]![k]=s*kp+c*kq}
    a[p]![p]=c*c*pp-2*s*c*pq+s*s*qq;a[q]![q]=s*s*pp+2*s*c*pq+c*c*qq;a[p]![q]=a[q]![p]=0
  }
  return a.map((row,i)=>Math.max(0,row[i]!)).sort((a,b)=>a-b)
}

/** Deterministic bounded Levenberg–Marquardt with pointwise Huber IRLS. */
export function optimizeJoint(initial:AppConfig):JointResult{
  let best=structuredClone(initial),iterations=0,converged=false
  const available=new Map(parameterSpecs().map(p=>[p.id,p]))
  const settings=initial.calibration.parameters.filter(p=>p.enabled&&available.has(p.id))
  const n=settings.length,scales=settings.map(p=>available.get(p.id)!.scale)
  const failure=(status:string,warnings:string[]=[]):JointResult=>({...calibrationDiagnostics(initial),config:structuredClone(initial),accepted:false,status,iterations,rank:0,parameterCount:n,condition:Infinity,warnings:[...calibrationDiagnostics(initial).warnings,...warnings]})
  const active=initial.calibration.observations.filter(o=>o.active&&o.weight>0)
  if(!n)return failure('Keine Parameter freigegeben.')
  if(active.length*2<n+2)return failure('Zu wenige aktive Punkte für die freigegebenen Parameter. Mehr Punkte setzen oder Parameter sperren.')
  if(settings.some(p=>!Number.isFinite(p.min)||!Number.isFinite(p.max)||p.min>=p.max||getParameter(initial,p.id)<p.min||getParameter(initial,p.id)>p.max))return failure('Parameterwert oder Parametergrenzen ungültig. Aktuelle Werte müssen innerhalb der Grenzen liegen.')
  const residual=(config:AppConfig):number[]|null=>{
    for(const o of config.roofObstructions){
      const {base}=calculateChimney(config.house,o,config.calibration.chimneyTopY,config.calibration.corrections[o.id])
      if(o.kind==='chimney'&&Math.max(...base.map(p=>p.y))>=config.calibration.chimneyTopY)return null
      if(o.alongMax<=o.alongMin||o.slopeMax<=o.slopeMin)return null
    }
    const diagnostics=calibrationDiagnostics(config),ps=diagnostics.points.filter(p=>p.active&&p.weight>0)
    if(ps.some(p=>!Number.isFinite(p.errorPx)))return null
    return ps.flatMap(p=>[p.dx,p.dy])
  }
  const delta=initial.calibration.robustThresholdPx
  const cost=(r:number[])=>active.reduce((sum,o,i)=>{const e=Math.hypot(r[2*i]!,r[2*i+1]!);return sum+o.weight*(e<=delta?.5*e*e:delta*(e-.5*delta))},0)
  const weights=(r:number[])=>active.flatMap((o,i)=>{const w=o.weight*Math.min(1,delta/Math.max(1e-12,Math.hypot(r[2*i]!,r[2*i+1]!)));return [w,w]})
  const jacobian=(config:AppConfig):number[][]=>{
    const r=residual(config)!,j=r.map(()=>Array<number>(n).fill(0))
    settings.forEach((p,k)=>{
      const value=getParameter(config,p.id),step=scales[k]!*1e-5
      const low=Math.max(p.min,value-step),high=Math.min(p.max,value+step)
      const plus=structuredClone(config),minus=structuredClone(config)
      setParameter(plus,p.id,high);setParameter(minus,p.id,low)
      const rp=residual(plus),rm=residual(minus)
      if(rp&&rm)for(let i=0;i<r.length;i++)j[i]![k]=(rp[i]!-rm[i]!)/(high-low)*scales[k]!
    })
    return j
  }
  const normal=(j:number[][],w:number[])=>Array.from({length:n},(_,k)=>Array.from({length:n},(_,l)=>j.reduce((s,row,i)=>s+w[i]!*row[k]!*row[l]!,0)))
  let r=residual(best)
  if(!r)return failure('Ungültige Ausgangsgeometrie oder Punkte hinter der Kamera. Letzter Stand erhalten.')
  const initialCost=cost(r)
  let score=initialCost,lambda=1e-3
  for(iterations=0;iterations<180;iterations++){
    const j=jacobian(best),w=weights(r),a=normal(j,w)
    const gradient=Array.from({length:n},(_,k)=>j.reduce((s,row,i)=>s+w[i]!*row[k]!*r![i]!,0))
    const feasibleGradient=gradient.map((g,k)=>{
      const p=settings[k]!,value=getParameter(best,p.id)
      return (value<=p.min+1e-10&&g>0)||(value>=p.max-1e-10&&g<0)?0:g
    })
    if(Math.max(...feasibleGradient.map(Math.abs))<1e-7){converged=true;break}
    const damped=a.map((row,k)=>row.map((v,l)=>v+(k===l?lambda*Math.max(a[k]![k]!,1):0)))
    const step=solve(damped,gradient.map(v=>-v))
    if(!step)return failure('Numerisch singuläre Parameterkombination. Parameter sperren.')
    const candidate=structuredClone(best)
    settings.forEach((p,k)=>setParameter(candidate,p.id,Math.min(p.max,Math.max(p.min,getParameter(best,p.id)+step[k]!*scales[k]!))))
    const next=residual(candidate),nextCost=next?cost(next):Infinity
    if(next&&nextCost<score){
      const improvement=score-nextCost
      best=candidate;r=next;score=nextCost;lambda=Math.max(1e-10,lambda/3)
      if(improvement<1e-9*(1+score)){converged=true;break}
    }else{
      lambda*=10
      if(lambda>1e14)break
    }
  }
  if(!converged)return failure('Keine stabile Konvergenz. Letzter gültiger Stand bleibt erhalten.')
  const j=jacobian(best),a=normal(j,weights(r)),normalized=a.map((row,k)=>row.map((v,l)=>v/Math.sqrt(Math.max(1e-30,a[k]![k]!*a[l]![l]!))))
  const eigen=eigenvalues(normalized),largest=eigen.at(-1)??0,smallest=eigen[0]??0
  const rank=eigen.filter(v=>v>largest*1e-10).length,condition=largest/Math.max(1e-30,smallest)
  if(rank<n)return {...failure('Parameterkombination nicht eindeutig bestimmbar. Letzter gültiger Stand erhalten.',['Nicht beobachtbare Freiheitsgrade: Parameter sperren oder räumlich verteilte Punkte ergänzen.']),rank,condition}
  const diagnostics=calibrationDiagnostics(best),warnings=[...diagnostics.warnings]
  if(condition>1e6)warnings.push('Stark korrelierte Parameter: geringe Restfehler bedeuten hier keine präzise bestimmte Geometrie. Weniger Parameter freigeben oder zusätzliche räumlich verteilte Referenzen setzen.')
  if(settings.some(p=>Math.min(Math.abs(getParameter(best,p.id)-p.min),Math.abs(getParameter(best,p.id)-p.max))<1e-5))warnings.push('Mindestens ein Parameter liegt an seiner Grenze. Geometrie und Freigaben prüfen.')
  const cam=best.photoCamera
  if(cam.verticalFovDeg<30||cam.verticalFovDeg>85||Math.abs(cam.principalX)>.15||Math.abs(cam.principalY)>.15)warnings.push('Ungewöhnlicher Bildwinkel oder Bildmittelpunkt für die iPhone-Referenz. Cropping und Metadaten prüfen.')
  if(!active.some(o=>o.pointId.startsWith('base-')||o.pointId.startsWith('wall-top-')||o.pointId.includes(':top-')))warnings.push('Die Punkte liegen überwiegend auf Dachflächen. FOV, Kameradistanz und Dachgeometrie können korreliert sein; zusätzliche Punkte außerhalb der Dachebene helfen.')
  return {...diagnostics,config:best,accepted:true,status:score<initialCost?'Konvergiert':'Ausgangsstand bereits optimal',iterations:iterations+1,rank,parameterCount:n,condition,warnings}
}
