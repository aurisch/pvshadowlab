import './style.css'
import { SceneController } from './scene/SceneController.ts'
import { cloneDefaultConfig } from './config/defaults.ts'
import { exportConfig, importConfig } from './config/serialization.ts'
import { focalLength35ToVerticalFov, verticalFovToFocalLength35 } from './model/cameraMath.ts'
import type { AppConfig, CameraMode, OverlayMode } from './model/types.ts'
import { cameraControls, derivedText, getPath, houseControls, setPath, type NumericControlSpec } from './ui/controls.ts'
import { referencePoints } from './model/calibration.ts'
import { calibrationDiagnostics, optimizeJoint, type JointResult } from './model/jointCalibration.ts'
import { getParameter, parameterSpecs, setParameter } from './model/parameters.ts'
import { IDENTITY_CORRECTION } from './model/geometry.ts'
import { DroneWorkspace } from './ui/DroneWorkspace.ts'
import { loadLastPhoto, saveLastPhoto } from './config/photoStore.ts'
import { rotateCalibration } from './model/photoTransform.ts'

const STORAGE_KEY = 'pv-shadowlab-config-v1'
const CALIBRATION_VIEW_KEY = 'pv-shadowlab-calibration-view-v1'
let config = loadSavedConfig()
let photoUrl: string | null = null
let sourcePhoto: HTMLImageElement | null = null
let sourcePhotoName = ''
let calibrationActive = false
let lastResult:JointResult|null=null
let calibrationZoom = 1
let panStart: { x:number; y:number; left:number; top:number } | null = null
let suppressCalibrationClick = false
let unscaledStageSize: { width:number; height:number } | null = null

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <header class="topbar">
    <button id="toggle-panel" class="icon-button" aria-label="Parameterbereich ein- oder ausblenden">☰</button>
    <div><h1>PV ShadowLab</h1><span>Phase 2 · Gemeinsame geometrische Kalibrierung</span></div>
    <div class="mode-switch" role="group" aria-label="Kameramodus">
      <button data-camera-mode="free">Freie Ansicht</button>
      <button data-camera-mode="photo">Fotokamera</button>
      <button id="drone-mode">Dachvermessung</button>
    </div>
  </header>
  <main>
    <aside id="panel">
      <details open><summary>Gebäude & Dach</summary><div id="house-controls" class="control-list"></div>
        <p id="derived" class="derived"></p>
        <label class="check-row"><input id="show-obstruction-labels" type="checkbox"> Störflächen beschriften</label>
        <button id="reset-house">Haus zurücksetzen</button>
      </details>
      <details open><summary>Fotokamera</summary><div id="camera-controls" class="control-list"></div>
        <label class="single-input"><span>35-mm-äquiv. Brennweite</span><span><input id="focal-length" type="number" min="5" max="300" step="0.1"><i>mm</i></span></label>
        <p class="hint">Azimut 0° blickt nach +Z, 90° nach +X. Positive Elevation blickt aufwärts.</p>
        <button id="reset-camera">Aktive Kamera zurücksetzen</button>
      </details>
      <details open><summary>Foto & Überlagerung</summary>
        <label class="file-button">Referenzfoto auswählen<input id="photo-input" type="file" accept="image/*"></label>
        <div class="photo-tools" role="group" aria-label="Fotodrehung">
          <button id="rotate-left" title="90° gegen den Uhrzeigersinn drehen">↶ 90°</button>
          <button id="reset-rotation">Pflichtrotation 90° CCW</button>
          <button id="rotate-right" title="90° im Uhrzeigersinn drehen">↷ 90°</button>
        </div>
        <div class="segmented" role="group" aria-label="Darstellung">
          <button data-overlay="photo">Foto</button><button data-overlay="model">Modell</button><button data-overlay="overlay">Beides</button>
        </div>
        <label class="slider-row"><span>Modelldeckkraft</span><input id="opacity" type="range" min="0" max="1" step="0.01"><output id="opacity-value"></output></label>
        <p id="photo-info" class="hint">Kein Foto geladen. Die Datei bleibt ausschließlich lokal.</p>
      </details>
      <details open><summary>Kalibrierung</summary>
        <label class="check-row"><input id="show-calibration-markers" type="checkbox"> Alle Kalibrierungspunkte anzeigen</label>
        <label class="single-input"><span>Modellobjekt</span><select id="object-select"></select></label>
        <label class="single-input"><span>Eckpunkt</span><select id="landmark-select"></select></label>
        <p class="hint">Fenster: unten = Traufe, oben = First. Kamin: Dachanschluss und Öffnung getrennt. Ein vorhandener Punkt kann erneut gesetzt werden.</p>
        <label class="zoom-control"><span>Bildvergrößerung</span><input id="calibration-zoom" type="range" min="1" max="12" step="0.25" value="1"><output id="calibration-zoom-value">100 %</output></label>
        <button id="capture-point" class="calibration-button">Punkt im Foto setzen / korrigieren</button>
        <button id="solve-calibration" class="calibration-button">Kalibrierung berechnen</button>
        <p id="calibration-status" class="hint" role="status"></p>
        <p class="hint">Kreise = Messpunkte · cyanfarbene Kreuze = Modellprojektion · Linien = Restfehler. Fehler in Originalbild-Pixeln; Klick auf Messpunkt zum Korrigieren.</p>
        <div id="calibration-list" class="calibration-list"></div>
        <details><summary>Experten: Parameter & Referenzen</summary>
          <p class="hint">Haken gibt einen Parameter frei. Ohne Haken bleibt der Wert fest. Nur begründet weitere Parameter freigeben. Gebäude 9,10 × 9,10 m (Rohbau 8,99 m); Dachneigung 30°, Überstände 0,90 / 0,815 m. Firstlänge und Dachschräge werden daraus abgeleitet.</p>
          <p class="hint">Bildwinkel startet bei 26 mm Kleinbildäquivalent, diagonal auf das gedrehte Bildformat umgerechnet. EXIF wird vom Browser berücksichtigt. Cropping ist unbekannt; keine Verzeichnungskorrektur. Bildmittelpunkt X/Y in normierten Bildkoordinaten (rechts/oben positiv).</p>
          <label class="single-input"><span>Robuste Schwelle (px)</span><input id="robust-threshold" type="number" min="0.5" max="100" step="0.5"></label>
          <div id="parameter-controls"></div>
          <div id="reference-deviations" class="hint"></div>
          <div id="migration-notes" class="hint"></div>
          <button id="export-legacy">Phase-1-Original exportieren</button>
        </details>
      </details>
      <details><summary>Konfiguration</summary>
        <div class="button-grid"><button id="export-config">JSON exportieren</button><label class="file-button">JSON importieren<input id="import-config" type="file" accept="application/json,.json"></label></div>
        <p id="status" class="status" role="status"></p>
      </details>
    </aside>
    <section id="workspace">
      <div id="zoom-surface">
        <div id="stage">
          <img id="reference-photo" alt="Lokales Referenzfoto des Hauses">
          <div id="viewport"></div>
          <div id="empty-photo" class="empty-photo">Fotokamera aktiv · Referenzfoto links auswählen</div>
          <span id="precision-cursor" aria-hidden="true"></span>
        </div>
      </div>
      <div class="axis-note">X Breite · Y Höhe · Z Tiefe · Einheit Meter</div>
    </section>
    <section id="drone-workspace" hidden></section>
  </main>`

const viewport = element<HTMLDivElement>('viewport')
const stage = element<HTMLDivElement>('stage')
const referencePhoto = element<HTMLImageElement>('reference-photo')
const scene = new SceneController(viewport, config)
const landmarkSelect = element<HTMLSelectElement>('landmark-select')
let droneWorkspace:DroneWorkspace|null=null

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id)
  if (!found) throw new Error(`Element #${id} fehlt.`)
  return found as T
}

function loadSavedConfig(): AppConfig {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return cloneDefaultConfig()
  try {
    const raw=JSON.parse(saved) as {version?:number}
    if(raw.version===1&&!localStorage.getItem('pv-shadowlab-before-phase2'))localStorage.setItem('pv-shadowlab-before-phase2',saved)
    const loaded=importConfig(saved)
    return loaded
  } catch {
    const fallback=cloneDefaultConfig()
    fallback.calibration.legacyConfig=saved
    fallback.calibration.migrationNotes.push('Gespeicherte Konfiguration konnte nicht sicher gelesen werden. Unverändertes Original ist über den Original-Export verfügbar; Import bitte prüfen.')
    return fallback
  }
}

function persist(): void {
  localStorage.setItem(STORAGE_KEY, exportConfig(config))
}

function createControls(hostId: string, specs: NumericControlSpec[]): void {
  const host = element<HTMLDivElement>(hostId)
  host.replaceChildren(...specs.map((spec) => {
    const label = document.createElement('label')
    label.className = 'numeric-control'
    label.innerHTML = `<span>${spec.label}</span><input class="range" type="range" min="${spec.min}" max="${spec.max}" step="${spec.step}"><span class="number-wrap"><input class="number" type="number" min="${spec.min}" max="${spec.max}" step="${spec.step}"><i>${spec.unit ?? ''}</i></span>`
    label.dataset.path = spec.path
    for (const input of label.querySelectorAll<HTMLInputElement>('input')) {
      input.value = String(getPath(config, spec.path))
      input.addEventListener('input', () => {
        const value = Number(input.value)
        if (!Number.isFinite(value)) return
        setPath(config, spec.path, value)
        lastResult=null
        label.querySelectorAll<HTMLInputElement>('input').forEach((other) => { if (other !== input) other.value = input.value })
        applyConfig(spec.path.startsWith('house.'))
      })
    }
    return label
  }))
}

function syncControlValues(): void {
  document.querySelectorAll<HTMLElement>('[data-path]').forEach((label) => {
    const path = label.dataset.path!
    label.querySelectorAll<HTMLInputElement>('input').forEach((input) => { input.value = String(getPath(config, path)) })
  })
}

function applyConfig(geometryChanged = true): void {
  if (geometryChanged) scene.update(config)
  else scene.updateCameraOnly(config)
  persist()
  updateUiState()
  refreshLandmarks()
}

function updateUiState(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-camera-mode]').forEach((button) => button.classList.toggle('active', button.dataset.cameraMode === config.cameraMode))
  document.querySelectorAll<HTMLButtonElement>('[data-overlay]').forEach((button) => button.classList.toggle('active', button.dataset.overlay === config.overlayMode))
  element('derived').textContent = derivedText(config)
  const focal = element<HTMLInputElement>('focal-length')
  if (document.activeElement !== focal) focal.value = verticalFovToFocalLength35(config.photoCamera.verticalFovDeg, config.photoCamera.aspectRatio).toFixed(1)
  const opacity = element<HTMLInputElement>('opacity')
  opacity.value = String(config.modelOpacity)
  element<HTMLOutputElement>('opacity-value').value = `${Math.round(config.modelOpacity * 100)} %`
  stage.style.aspectRatio = config.cameraMode === 'photo' ? String(config.photoCamera.aspectRatio) : 'auto'
  stage.style.setProperty('--aspect', String(config.photoCamera.aspectRatio))
  stage.classList.toggle('photo-camera', config.cameraMode === 'photo')
  stage.classList.toggle('show-photo', config.cameraMode === 'photo' && config.overlayMode !== 'model' && photoUrl !== null)
  stage.classList.toggle('hide-model', config.cameraMode === 'photo' && config.overlayMode === 'photo')
  stage.classList.toggle('model-only', config.cameraMode === 'free' || config.overlayMode === 'model')
  element('empty-photo').classList.toggle('visible', config.cameraMode === 'photo' && !photoUrl)
  const aspectInputs = document.querySelectorAll<HTMLInputElement>('[data-path="photoCamera.aspectRatio"] input')
  aspectInputs.forEach((input) => { input.disabled = photoUrl !== null })
  element<HTMLInputElement>('show-obstruction-labels').checked=config.showObstructionLabels
  element<HTMLInputElement>('show-calibration-markers').checked=config.showCalibrationMarkers
}

createControls('house-controls', houseControls)
createControls('camera-controls', cameraControls)

document.querySelectorAll<HTMLButtonElement>('[data-camera-mode]').forEach((button) => button.addEventListener('click', () => {
  closeDroneWorkspace()
  config.cameraMode = button.dataset.cameraMode as CameraMode
  if(config.cameraMode==='free'){
    calibrationActive=false
    persistCalibrationView()
    setCalibrationZoom(1,undefined,undefined,false)
  }else{
    restoreCalibrationView()
  }
  applyConfig(false)
  updateCalibrationUi()
}))
element('drone-mode').addEventListener('click',()=>{
  const host=element<HTMLElement>('drone-workspace')
  element('panel').hidden=true;element('workspace').hidden=true;host.hidden=false
  element('drone-mode').classList.add('active')
  droneWorkspace??=new DroneWorkspace(host,config.roofObstructions,closeDroneWorkspace)
})
function closeDroneWorkspace():void{
  element('drone-workspace').hidden=true;element('panel').hidden=false;element('workspace').hidden=false
  element('drone-mode').classList.remove('active')
}
document.querySelectorAll<HTMLButtonElement>('[data-overlay]').forEach((button) => button.addEventListener('click', () => {
  config.overlayMode = button.dataset.overlay as OverlayMode
  applyConfig(false)
}))
element('toggle-panel').addEventListener('click', () => element('panel').classList.toggle('collapsed'))
element<HTMLInputElement>('show-obstruction-labels').addEventListener('change',(event)=>{
  config.showObstructionLabels=(event.target as HTMLInputElement).checked
  applyConfig()
})
element<HTMLInputElement>('show-calibration-markers').addEventListener('change',(event)=>{
  config.showCalibrationMarkers=(event.target as HTMLInputElement).checked
  persist()
  updateCalibrationUi()
})
element('reset-house').addEventListener('click', () => {
  lastResult=null
  config.house = cloneDefaultConfig().house
  syncControlValues()
  applyConfig()
})
element('reset-camera').addEventListener('click', () => {
  lastResult=null
  if (config.cameraMode === 'free') scene.resetFreeCamera()
  else {
    const aspectRatio = photoUrl ? config.photoCamera.aspectRatio : cloneDefaultConfig().photoCamera.aspectRatio
    config.photoCamera = { ...cloneDefaultConfig().photoCamera, aspectRatio }
    syncControlValues()
    applyConfig(false)
  }
})
element<HTMLInputElement>('focal-length').addEventListener('input', (event) => {
  const value = Number((event.target as HTMLInputElement).value)
  if (value <= 0) return
  lastResult=null
  config.photoCamera.verticalFovDeg = focalLength35ToVerticalFov(value, config.photoCamera.aspectRatio)
  syncControlValues()
  applyConfig(false)
})
element<HTMLInputElement>('opacity').addEventListener('input', (event) => {
  config.modelOpacity = Number((event.target as HTMLInputElement).value)
  applyConfig(false)
})
element<HTMLInputElement>('photo-input').addEventListener('change', (event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  void loadSourcePhoto(file, file.name, true)
})

async function loadSourcePhoto(blob: Blob, name: string, isNewPhoto: boolean): Promise<void> {
  const sourceUrl = URL.createObjectURL(blob)
  const image = new Image()
  image.onload = () => {
    URL.revokeObjectURL(sourceUrl)
    sourcePhoto = image
    sourcePhotoName = name
    if (isNewPhoto) {
      // Tripod series: camera and measurements persist across equal-format photos.
      persist()
      updateCalibrationUi()
      setCalibrationZoom(1)
    } else if(config.cameraMode==='photo') {
      restoreCalibrationView()
    }
    renderRotatedPhoto()
  }
  image.onerror = () => {
    URL.revokeObjectURL(sourceUrl)
    showStatus('Das Foto konnte nicht gelesen werden.', true)
  }
  image.src = sourceUrl
  if (isNewPhoto) {
    try {
      await saveLastPhoto({ blob, name })
    } catch {
      showStatus('Foto geladen, konnte aber nicht dauerhaft im Browser gespeichert werden.', true)
    }
  }
}
element('capture-point').addEventListener('click', () => {
  if (!photoUrl) { showStatus('Bitte zuerst ein Referenzfoto auswählen.', true); return }
  config.cameraMode='photo'
  calibrationActive=!calibrationActive
  config.showCalibrationMarkers=true
  applyConfig(false)
})
element('object-select').addEventListener('change',()=>{calibrationActive=false;refreshLandmarks()})
element('landmark-select').addEventListener('change',()=>{calibrationActive=false;updateCalibrationUi()})
element<HTMLInputElement>('calibration-zoom').addEventListener('input', (event) => {
  setCalibrationZoom(Number((event.target as HTMLInputElement).value))
})
function setCalibrationZoom(value:number, focalClientX?:number, focalClientY?:number, saveView=true):void {
  const workspace=element('workspace')
  const zoomSurface=element('zoom-surface')
  const oldZoom=calibrationZoom
  const rect=workspace.getBoundingClientRect()
  const focusX=(focalClientX??rect.left+rect.width/2)-rect.left
  const focusY=(focalClientY??rect.top+rect.height/2)-rect.top
  calibrationZoom=Math.min(12,Math.max(1,Math.round(value*20)/20))
  if(oldZoom===1 && calibrationZoom>1){
    const stageRect=stage.getBoundingClientRect()
    unscaledStageSize={width:stageRect.width,height:stageRect.height}
    stage.style.width=`${stageRect.width}px`
    stage.style.height=`${stageRect.height}px`
    stage.style.maxWidth='none'
    stage.style.maxHeight='none'
  }
  stage.style.setProperty('--calibration-zoom',String(calibrationZoom))
  stage.style.setProperty('--inverse-calibration-zoom',String(1/calibrationZoom))
  workspace.classList.toggle('zoomed',calibrationZoom>1)
  if(unscaledStageSize && calibrationZoom>1){
    zoomSurface.style.width=`${unscaledStageSize.width*calibrationZoom}px`
    zoomSurface.style.height=`${unscaledStageSize.height*calibrationZoom}px`
  }
  element<HTMLInputElement>('calibration-zoom').value=String(calibrationZoom)
  element<HTMLOutputElement>('calibration-zoom-value').value=`${Math.round(calibrationZoom*100)} %`
  if(calibrationZoom===1){
    workspace.scrollTo(0,0)
    stage.style.removeProperty('width');stage.style.removeProperty('height')
    stage.style.removeProperty('max-width');stage.style.removeProperty('max-height')
    zoomSurface.style.removeProperty('width');zoomSurface.style.removeProperty('height')
    unscaledStageSize=null
    if(saveView)persistCalibrationView()
    return
  }
  const ratio=calibrationZoom/oldZoom
  requestAnimationFrame(()=>{
    workspace.scrollTo((workspace.scrollLeft+focusX)*ratio-focusX,(workspace.scrollTop+focusY)*ratio-focusY)
    if(saveView)persistCalibrationView()
  })
}
stage.addEventListener('wheel',(event)=>{
  if(config.cameraMode!=='photo')return
  event.preventDefault()
  setCalibrationZoom(calibrationZoom*Math.exp(-event.deltaY*0.0015),event.clientX,event.clientY)
},{passive:false})
element('workspace').addEventListener('pointerdown',(event)=>{
  if(calibrationZoom<=1 || config.cameraMode!=='photo')return
  if(!(event.target instanceof Node) || !stage.contains(event.target))return
  if(event.target instanceof Element&&event.target.closest('button.calibration-marker'))return
  event.preventDefault()
  event.stopPropagation()
  const workspace=element('workspace')
  panStart={x:event.clientX,y:event.clientY,left:workspace.scrollLeft,top:workspace.scrollTop}
  suppressCalibrationClick=false
  workspace.setPointerCapture(event.pointerId)
  stage.classList.add('panning')
},true)
element('workspace').addEventListener('pointermove',(event)=>{
  if(!panStart)return
  event.preventDefault()
  const dx=event.clientX-panStart.x,dy=event.clientY-panStart.y
  if(Math.hypot(dx,dy)>3)suppressCalibrationClick=true
  const workspace=element('workspace')
  workspace.scrollLeft=panStart.left-dx
  workspace.scrollTop=panStart.top-dy
},true)
element('workspace').addEventListener('pointerup',(event)=>{
  if(!panStart)return
  event.preventDefault()
  const wasDrag=suppressCalibrationClick
  panStart=null
  element('workspace').releasePointerCapture(event.pointerId)
  stage.classList.remove('panning')
  if(!wasDrag && calibrationActive) placeCalibrationPoint(event.clientX,event.clientY)
  suppressCalibrationClick=true
  persistCalibrationView()
},true)
stage.addEventListener('mousemove',(event)=>{
  if(!calibrationActive)return
  const rect=stage.getBoundingClientRect()
  const cursor=element('precision-cursor')
  cursor.style.left=`${(event.clientX-rect.left)/calibrationZoom}px`
  cursor.style.top=`${(event.clientY-rect.top)/calibrationZoom}px`
})
stage.addEventListener('click', (event) => {
  if(suppressCalibrationClick){ suppressCalibrationClick=false; return }
  if ((!calibrationActive) || config.cameraMode !== 'photo') return
  placeCalibrationPoint(event.clientX,event.clientY)
})
function placeCalibrationPoint(clientX:number,clientY:number):void {
  if ((!calibrationActive) || config.cameraMode !== 'photo') return
  const rect=stage.getBoundingClientRect()
  const x=((clientX-rect.left)/rect.width)*2-1
  const y=1-((clientY-rect.top)/rect.height)*2
  const existing=config.calibration.observations.find(o=>o.pointId===landmarkSelect.value)
  if(existing){existing.x=x;existing.y=y}
  else config.calibration.observations.push({pointId:landmarkSelect.value,x,y,active:true,weight:1})
  calibrationActive=false
  lastResult=null
  persist()
  updateCalibrationUi()
}
element('solve-calibration').addEventListener('click',()=>{
  lastResult=optimizeJoint(config)
  if(lastResult.accepted){config=lastResult.config;syncControlValues();applyConfig()}
  else updateCalibrationUi()
})
element<HTMLInputElement>('robust-threshold').addEventListener('change',event=>{
  const value=Number((event.target as HTMLInputElement).value)
  if(value>0&&value<=100){config.calibration.robustThresholdPx=value;lastResult=null;persist();updateCalibrationUi()}
})
element('export-legacy').addEventListener('click',()=>{
  const original=config.calibration.legacyConfig??localStorage.getItem('pv-shadowlab-before-phase2')
  if(original)downloadJson(original,'pv-shadowlab-phase1-original.json')
})
element('rotate-left').addEventListener('click', () => rotatePhoto(90))
element('rotate-right').addEventListener('click', () => rotatePhoto(-90))
element('reset-rotation').addEventListener('click', () => {
  if (!sourcePhoto) return
  rotatePhoto(90-config.photoRotationDeg)
})
function downloadJson(json:string,name:string):void{
  const url=URL.createObjectURL(new Blob([json],{type:'application/json'}))
  const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click()
  URL.revokeObjectURL(url)
}
element('export-config').addEventListener('click',()=>{
  downloadJson(exportConfig(config),'pv-shadowlab-konfiguration.json')
  showStatus('Konfiguration exportiert.')
})
element<HTMLInputElement>('import-config').addEventListener('change', async (event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    config = importConfig(await file.text())
    calibrationActive=false
    lastResult=null
    if(sourcePhoto)renderRotatedPhoto()
    syncControlValues()
    applyConfig()
    showStatus('Konfiguration erfolgreich importiert.')
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Import fehlgeschlagen.', true)
  }
})

function showStatus(message: string, error = false): void {
  const status = element('status')
  status.textContent = message
  status.classList.toggle('error', error)
}

function rotatePhoto(deltaDeg: number): void {
  if (!sourcePhoto) {
    showStatus('Bitte zuerst ein Referenzfoto auswählen.', true)
    return
  }
  rotateCalibration(config,deltaDeg)
  lastResult=null
  renderRotatedPhoto()
}

function renderRotatedPhoto(): void {
  if (!sourcePhoto) return
  const quarterTurn = config.photoRotationDeg === 90 || config.photoRotationDeg === 270
  const canvas = document.createElement('canvas')
  canvas.width = quarterTurn ? sourcePhoto.naturalHeight : sourcePhoto.naturalWidth
  canvas.height = quarterTurn ? sourcePhoto.naturalWidth : sourcePhoto.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) {
    showStatus('Fotobearbeitung wird von diesem Browser nicht unterstützt.', true)
    return
  }
  context.translate(canvas.width / 2, canvas.height / 2)
  // Positive Konfigurationswinkel bedeuten fachlich CCW; Canvas dreht bei positivem
  // Winkel im Bildschirmkoordinatensystem im Uhrzeigersinn, daher das Minuszeichen.
  context.rotate(-config.photoRotationDeg * Math.PI / 180)
  context.drawImage(sourcePhoto, -sourcePhoto.naturalWidth / 2, -sourcePhoto.naturalHeight / 2)
  canvas.toBlob((blob) => {
    if (!blob) {
      showStatus('Das gedrehte Foto konnte nicht erzeugt werden.', true)
      return
    }
    if (photoUrl) URL.revokeObjectURL(photoUrl)
    photoUrl = URL.createObjectURL(blob)
    referencePhoto.onload = () => {
      const width=referencePhoto.naturalWidth,height=referencePhoto.naturalHeight
      const oldAspect=config.photoCamera.aspectRatio,newAspect=width/height
      if(Math.abs(oldAspect-newAspect)>1e-8){
        const focal=verticalFovToFocalLength35(config.photoCamera.verticalFovDeg,oldAspect)
        config.photoCamera.verticalFovDeg=focalLength35ToVerticalFov(focal,newAspect)
      }
      config.photoCamera.aspectRatio=newAspect
      if(config.calibration.observations.length&&Math.abs(config.calibration.imageWidth/config.calibration.imageHeight-newAspect)>1e-8){
        config.calibration.observations.forEach(o=>{o.active=false})
        showStatus('Anderes Bildformat: Messpunkte zur Prüfung deaktiviert. Kamerapose bleibt erhalten; Bildwinkel an das Format angepasst.',true)
      }
      config.calibration.imageWidth=width;config.calibration.imageHeight=height
      config.cameraMode = 'photo'
      syncControlValues()
      element('photo-info').textContent = `${sourcePhotoName} · ${referencePhoto.naturalWidth} × ${referencePhoto.naturalHeight} px · ${config.photoRotationDeg}° CCW · Seitenverhältnis fixiert`
      applyConfig(false)
    }
    referencePhoto.src = photoUrl
  }, 'image/png')
}

function refreshLandmarks(): void {
  const refs=referencePoints(config),objectSelect=element<HTMLSelectElement>('object-select')
  const selectedObject=objectSelect.value,selected=landmarkSelect.value
  const objects=new Map(refs.map(p=>[p.objectId,p.objectName]))
  objectSelect.replaceChildren(...[...objects].map(([id,name])=>new Option(name,id)))
  if(objects.has(selectedObject))objectSelect.value=selectedObject
  landmarkSelect.replaceChildren(...refs.filter(p=>p.objectId===objectSelect.value).map(p=>new Option(p.label,p.id)))
  if([...landmarkSelect.options].some(o=>o.value===selected))landmarkSelect.value=selected
  updateCalibrationUi()
}

function selectMeasurement(id:string):void{
  const ref=referencePoints(config).find(p=>p.id===id)
  if(!ref)return
  element<HTMLSelectElement>('object-select').value=ref.objectId
  refreshLandmarks();landmarkSelect.value=id
  if(photoUrl&&config.cameraMode==='photo')calibrationActive=true
  updateCalibrationUi()
}

function updateCalibrationUi(): void {
  const capture=element<HTMLButtonElement>('capture-point')
  capture.classList.toggle('active',calibrationActive)
  capture.textContent=calibrationActive?'Jetzt ins Foto klicken …':'Punkt im Foto setzen / korrigieren'
  stage.classList.toggle('calibration-active',calibrationActive&&config.cameraMode==='photo')
  stage.querySelectorAll('.calibration-marker,.calibration-residuals').forEach(m=>m.remove())
  element<HTMLInputElement>('show-calibration-markers').checked=config.showCalibrationMarkers
  const diagnostics=calibrationDiagnostics(config)
  if(config.cameraMode==='photo'&&config.showCalibrationMarkers){
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg')
    svg.classList.add('calibration-residuals');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none')
    for(const p of diagnostics.points){
      const marker=document.createElement('button')
      marker.type='button';marker.className='calibration-marker'+(p.objectId==='east-01'?' chimney-marker':p.objectId!=='house'?' obstruction-marker':'')+(p.active?'':' inactive-marker')
      marker.title=p.label+' – klicken zum Korrigieren';marker.setAttribute('aria-label',marker.title)
      marker.style.left=(p.measured.x+1)*50+'%';marker.style.top=(1-p.measured.y)*50+'%'
      marker.addEventListener('click',event=>{event.stopPropagation();selectMeasurement(p.pointId)})
      marker.addEventListener('pointerdown',event=>event.stopPropagation())
      stage.append(marker)
      if(p.projected){
        const line=document.createElementNS(svg.namespaceURI,'line')
        if(!p.active)line.setAttribute('opacity','0.3')
        line.setAttribute('x1',String((p.measured.x+1)*50));line.setAttribute('y1',String((1-p.measured.y)*50))
        line.setAttribute('x2',String((p.projected.x+1)*50));line.setAttribute('y2',String((1-p.projected.y)*50))
        line.setAttribute('vector-effect','non-scaling-stroke');svg.append(line)
        const projected=document.createElement('span');projected.className='calibration-marker projected-marker'+(p.active?'':' inactive-marker')
        projected.style.left=(p.projected.x+1)*50+'%';projected.style.top=(1-p.projected.y)*50+'%';stage.append(projected)
      }
    }
    stage.append(svg)
  }
  const status=element('calibration-status')
  status.textContent=(lastResult?lastResult.status+' · '+lastResult.iterations+' Iterationen · Rang '+lastResult.rank+'/'+lastResult.parameterCount:'Aktueller Modellstand')+' · '+diagnostics.activeCount+' aktive Punkte · RMS '+diagnostics.rmsPx.toFixed(2)+' px · Maximum '+diagnostics.maxPx.toFixed(2)+' px'
  if(lastResult?.accepted&&lastResult.condition>1e6)status.textContent+=' · schwach bestimmt'
  const warnings=[...new Set([...diagnostics.warnings,...(lastResult?.warnings??[])])]
  for(const warning of warnings){const p=document.createElement('p');p.className='calibration-warning';p.textContent=warning;status.append(p)}
  const list=element('calibration-list');list.replaceChildren()
  for(const p of [...diagnostics.points].sort((a,b)=>b.errorPx-a.errorPx)){
    const row=document.createElement('div');row.className='measurement-row'
    const active=document.createElement('input');active.type='checkbox';active.checked=p.active;active.title='Punkt aktivieren / deaktivieren'
    active.addEventListener('change',()=>{config.calibration.observations.find(o=>o.pointId===p.pointId)!.active=active.checked;lastResult=null;persist();updateCalibrationUi()})
    const name=document.createElement('button');name.textContent=p.label;name.title='Punkt erneut setzen';name.addEventListener('click',()=>selectMeasurement(p.pointId))
    const error=document.createElement('span');error.textContent=Number.isFinite(p.errorPx)?p.errorPx.toFixed(1)+' px':'nicht projizierbar';error.title=p.robustWeight<1?'Robust abgewichtet (Faktor '+p.robustWeight.toFixed(3)+')':'Volles Messgewicht'
    const weight=document.createElement('input');weight.type='number';weight.min='0.01';weight.max='100';weight.step='0.1';weight.value=String(p.weight);weight.title='Messgewicht'
    weight.addEventListener('change',()=>{const v=Number(weight.value);if(v>0&&v<=100){config.calibration.observations.find(o=>o.pointId===p.pointId)!.weight=v;lastResult=null;persist();updateCalibrationUi()}})
    const remove=document.createElement('button');remove.textContent='×';remove.title='Nur diesen Punkt löschen';remove.addEventListener('click',()=>{config.calibration.observations=config.calibration.observations.filter(o=>o.pointId!==p.pointId);lastResult=null;persist();updateCalibrationUi()})
    row.append(active,name,error,weight,remove);list.append(row)
  }
  if(!diagnostics.points.length)list.textContent='Noch keine Punkte gesetzt. Mindestens vier gut verteilte Punkte für die sechs Kameraparameter verwenden.'
  element<HTMLInputElement>('robust-threshold').value=String(config.calibration.robustThresholdPx)
  renderParameterControls()
  const notes=element('migration-notes');notes.replaceChildren(...config.calibration.migrationNotes.map(note=>{const p=document.createElement('p');p.textContent=note;return p}))
  element<HTMLButtonElement>('export-legacy').hidden=!config.calibration.legacyConfig&&!localStorage.getItem('pv-shadowlab-before-phase2')
  const deviations=element('reference-deviations');deviations.replaceChildren()
  const geometry=document.createElement('p')
  geometry.textContent='Abgeleitete Firstlänge '+(config.house.depth+2*config.house.gableOverhang).toFixed(3)+' m; Dachschräge '+((config.house.width/2+config.house.eaveOverhang)/Math.cos(config.house.roofPitchDeg*Math.PI/180)).toFixed(3)+' m. Kaminoberkante Y = '+config.calibration.chimneyTopY.toFixed(3)+' m (absolut).'
  deviations.append(geometry)
  if(lastResult){const p=document.createElement('p');p.textContent='Konditionszahl der normierten Informationsmatrix: '+lastResult.condition.toExponential(2)+'. Große Werte zeigen korrelierte Parameter; keine Messgenauigkeit ableitbar.';deviations.append(p)}
  for(const o of config.roofObstructions){
    const c=config.calibration.corrections[o.id]??IDENTITY_CORRECTION
    const p=document.createElement('p');p.textContent=o.name+': PV-Plan X '+o.alongMin+'…'+o.alongMax+' m, Y '+o.slopeMin+'…'+o.slopeMax+' m; Korrektur Position '+c.alongOffset.toFixed(3)+' / '+c.slopeOffset.toFixed(3)+' m, Maße × '+c.alongScale.toFixed(4)+' / '+c.slopeScale.toFixed(4);deviations.append(p)
  }
}

function renderParameterControls():void{
  const host=element('parameter-controls');host.replaceChildren()
  let group=''
  for(const spec of parameterSpecs()){
    if(group!==spec.group){const heading=document.createElement('p');heading.textContent=spec.group;heading.className='parameter-heading';host.append(heading);group=spec.group}
    const setting=config.calibration.parameters.find(p=>p.id===spec.id)!
    const row=document.createElement('div');row.className='parameter-row'
    const enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=setting.enabled;enabled.title='Parameter freigeben'
    enabled.addEventListener('change',()=>{setting.enabled=enabled.checked;lastResult=null;persist();updateCalibrationUi()})
    const label=document.createElement('label');label.textContent=spec.label
    const current=document.createElement('input');current.type='number';current.step='any';current.value=getParameter(config,spec.id).toFixed(5);current.title='Aktueller Wert';current.min=String(setting.min);current.max=String(setting.max)
    current.addEventListener('change',()=>{const v=Number(current.value);if(Number.isFinite(v)&&v>=setting.min&&v<=setting.max){setParameter(config,spec.id,v);lastResult=null;syncControlValues();applyConfig()}else updateCalibrationUi()})
    const bounds=document.createElement('div');bounds.className='parameter-bounds'
    for(const key of ['min','max'] as const){const input=document.createElement('input');input.type='number';input.step='any';input.value=String(setting[key]);input.title=key==='min'?'Untergrenze':'Obergrenze';input.addEventListener('change',()=>{const v=Number(input.value);if(Number.isFinite(v)&&v>=spec.min&&v<=spec.max&&(key==='min'?v<setting.max:v>setting.min)){setting[key]=v;lastResult=null;persist()}else input.value=String(setting[key])});bounds.append(input)}
    row.append(enabled,label,current,bounds);host.append(row)
  }
}

function persistCalibrationView():void {
  const workspace=element('workspace')
  localStorage.setItem(CALIBRATION_VIEW_KEY,JSON.stringify({
    zoom:calibrationZoom,
    left:workspace.scrollLeft,
    top:workspace.scrollTop,
  }))
}

function restoreCalibrationView():void {
  try {
    const value=JSON.parse(localStorage.getItem(CALIBRATION_VIEW_KEY)??'null') as {zoom?:unknown;left?:unknown;top?:unknown}|null
    if(!value || typeof value.zoom!=='number')return
    setCalibrationZoom(value.zoom)
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const workspace=element('workspace')
      if(typeof value.left==='number')workspace.scrollLeft=value.left
      if(typeof value.top==='number')workspace.scrollTop=value.top
    }))
  } catch {
    // Eine beschädigte reine Ansichtspräferenz beeinflusst die Kalibrierung nicht.
  }
}

updateUiState()
refreshLandmarks()
void restoreLastPhoto()

async function restoreLastPhoto(): Promise<void> {
  try {
    const stored = await loadLastPhoto()
    if (stored) await loadSourcePhoto(stored.blob, stored.name, false)
  } catch {
    showStatus('Das zuletzt verwendete Foto konnte nicht wiederhergestellt werden.', true)
  }
}
