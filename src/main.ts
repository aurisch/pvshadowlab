import './style.css'
import { SceneController } from './scene/SceneController.ts'
import { cloneDefaultConfig } from './config/defaults.ts'
import { exportConfig, importConfig } from './config/serialization.ts'
import { focalLength35ToVerticalFov, verticalFovToFocalLength35 } from './model/cameraMath.ts'
import type { AppConfig, CalibrationObservation, CameraMode, OverlayMode } from './model/types.ts'
import { cameraControls, derivedText, getPath, houseControls, setPath, type NumericControlSpec } from './ui/controls.ts'
import { calibrationLandmarks, optimizeCamera } from './model/calibration.ts'
import { loadLastPhoto, saveLastPhoto } from './config/photoStore.ts'
import { IPHONE_11_PRO_PHOTO_REFERENCE } from './config/photoReference.ts'

const STORAGE_KEY = 'pv-shadowlab-config-v1'
const CALIBRATION_VIEW_KEY = 'pv-shadowlab-calibration-view-v1'
let config = loadSavedConfig()
let photoUrl: string | null = null
let sourcePhoto: HTMLImageElement | null = null
let sourcePhotoName = ''
let calibrationObservations: CalibrationObservation[] = [...config.calibrationObservations]
let calibrationActive = false
let calibrationZoom = 1
let panStart: { x:number; y:number; left:number; top:number } | null = null
let suppressCalibrationClick = false
let unscaledStageSize: { width:number; height:number } | null = null

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <header class="topbar">
    <button id="toggle-panel" class="icon-button" aria-label="Parameterbereich ein- oder ausblenden">☰</button>
    <div><h1>PV ShadowLab</h1><span>Phase 1 · Hausmodell & Kamerakalibrierung</span></div>
    <div class="mode-switch" role="group" aria-label="Kameramodus">
      <button data-camera-mode="free">Freie Ansicht</button>
      <button data-camera-mode="photo">Fotokamera</button>
    </div>
  </header>
  <main>
    <aside id="panel">
      <details open><summary>Gebäude & Dach</summary><div id="house-controls" class="control-list"></div>
        <p id="derived" class="derived"></p><button id="reset-house">Haus zurücksetzen</button>
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
      <details><summary>Punktkalibrierung</summary>
        <label class="single-input"><span>Modellpunkt</span><select id="landmark-select"></select></label>
        <label class="zoom-control"><span>Bildvergrößerung</span><input id="calibration-zoom" type="range" min="1" max="12" step="0.25" value="1"><output id="calibration-zoom-value">100 %</output></label>
        <button id="capture-point" class="calibration-button">Punkt im Foto setzen</button>
        <div id="calibration-list" class="calibration-list"></div>
        <div class="button-grid"><button id="solve-camera">Kamera berechnen</button><button id="clear-points">Punkte löschen</button></div>
        <p id="calibration-status" class="hint">Mindestens vier gut verteilte Punkte setzen; sechs oder mehr sind besser.</p>
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
  </main>`

const viewport = element<HTMLDivElement>('viewport')
const stage = element<HTMLDivElement>('stage')
const referencePhoto = element<HTMLImageElement>('reference-photo')
const scene = new SceneController(viewport, config)
const landmarkSelect = element<HTMLSelectElement>('landmark-select')

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id)
  if (!found) throw new Error(`Element #${id} fehlt.`)
  return found as T
}

function loadSavedConfig(): AppConfig {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return cloneDefaultConfig()
  try { return importConfig(saved) } catch { return cloneDefaultConfig() }
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
  if (geometryChanged) refreshLandmarks()
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
}

createControls('house-controls', houseControls)
createControls('camera-controls', cameraControls)

document.querySelectorAll<HTMLButtonElement>('[data-camera-mode]').forEach((button) => button.addEventListener('click', () => {
  config.cameraMode = button.dataset.cameraMode as CameraMode
  applyConfig(false)
}))
document.querySelectorAll<HTMLButtonElement>('[data-overlay]').forEach((button) => button.addEventListener('click', () => {
  config.overlayMode = button.dataset.overlay as OverlayMode
  applyConfig(false)
}))
element('toggle-panel').addEventListener('click', () => element('panel').classList.toggle('collapsed'))
element('reset-house').addEventListener('click', () => {
  config.house = cloneDefaultConfig().house
  syncControlValues()
  applyConfig()
})
element('reset-camera').addEventListener('click', () => {
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
      config.photoRotationDeg = IPHONE_11_PRO_PHOTO_REFERENCE.requiredRotationDeg
      calibrationObservations=[]
      persistCalibrationObservations()
      updateCalibrationUi()
      setCalibrationZoom(1)
    } else {
      restoreCalibrationView()
    }
    renderRotatedPhoto(isNewPhoto)
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
  calibrationActive = !calibrationActive
  updateCalibrationUi()
})
element<HTMLInputElement>('calibration-zoom').addEventListener('input', (event) => {
  setCalibrationZoom(Number((event.target as HTMLInputElement).value))
})
function setCalibrationZoom(value:number, focalClientX?:number, focalClientY?:number):void {
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
    persistCalibrationView()
    return
  }
  const ratio=calibrationZoom/oldZoom
  requestAnimationFrame(()=>{
    workspace.scrollTo((workspace.scrollLeft+focusX)*ratio-focusX,(workspace.scrollTop+focusY)*ratio-focusY)
    persistCalibrationView()
  })
}
stage.addEventListener('wheel',(event)=>{
  event.preventDefault()
  setCalibrationZoom(calibrationZoom*Math.exp(-event.deltaY*0.0015),event.clientX,event.clientY)
},{passive:false})
element('workspace').addEventListener('pointerdown',(event)=>{
  if(calibrationZoom<=1)return
  if(!(event.target instanceof Node) || !stage.contains(event.target))return
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
  if (!calibrationActive || config.cameraMode !== 'photo') return
  placeCalibrationPoint(event.clientX,event.clientY)
})
function placeCalibrationPoint(clientX:number,clientY:number):void {
  if (!calibrationActive || config.cameraMode !== 'photo') return
  const rect=stage.getBoundingClientRect()
  const x=((clientX-rect.left)/rect.width)*2-1
  const y=1-((clientY-rect.top)/rect.height)*2
  calibrationObservations=calibrationObservations.filter(o=>o.landmarkId!==landmarkSelect.value)
  calibrationObservations.push({landmarkId:landmarkSelect.value,x,y})
  persistCalibrationObservations()
  calibrationActive=false
  updateCalibrationUi()
}
element('clear-points').addEventListener('click', () => {
  calibrationObservations=[]
  persistCalibrationObservations()
  updateCalibrationUi()
})
element('solve-camera').addEventListener('click', () => {
  if(calibrationObservations.length<4){ element('calibration-status').textContent='Mindestens vier Punkte erforderlich.'; return }
  const result=optimizeCamera(config.house,config.photoCamera,calibrationObservations)
  config.photoCamera=result.camera
  syncControlValues()
  applyConfig(false)
  const rect=stage.getBoundingClientRect()
  const rmsPx=result.rmsNormalized*Math.hypot(rect.width,rect.height)/2
  element('calibration-status').textContent=`Optimiert: mittlerer Projektionsfehler ca. ${rmsPx.toFixed(1)} px. FOV blieb unverändert.`
})
element('rotate-left').addEventListener('click', () => rotatePhoto(90))
element('rotate-right').addEventListener('click', () => rotatePhoto(-90))
element('reset-rotation').addEventListener('click', () => {
  if (!sourcePhoto) return
  config.photoRotationDeg = 90
  renderRotatedPhoto(false)
})
element('export-config').addEventListener('click', () => {
  const blob = new Blob([exportConfig(config)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'pv-shadowlab-konfiguration.json'
  anchor.click()
  URL.revokeObjectURL(url)
  showStatus('Konfiguration exportiert.')
})
element<HTMLInputElement>('import-config').addEventListener('change', async (event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    config = importConfig(await file.text())
    calibrationObservations=[...config.calibrationObservations]
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

function persistCalibrationObservations():void {
  config.calibrationObservations=[...calibrationObservations]
  persist()
}

function rotatePhoto(deltaDeg: number): void {
  if (!sourcePhoto) {
    showStatus('Bitte zuerst ein Referenzfoto auswählen.', true)
    return
  }
  config.photoRotationDeg = ((config.photoRotationDeg + deltaDeg + 360) % 360) as AppConfig['photoRotationDeg']
  renderRotatedPhoto(false)
}

function renderRotatedPhoto(applyOpticalDefaults = false): void {
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
      config.photoCamera.aspectRatio = referencePhoto.naturalWidth / referencePhoto.naturalHeight
      if (applyOpticalDefaults) {
        config.photoCamera.verticalFovDeg = focalLength35ToVerticalFov(
          IPHONE_11_PRO_PHOTO_REFERENCE.equivalentFocalLength35Mm,
          config.photoCamera.aspectRatio,
        )
      }
      config.cameraMode = 'photo'
      syncControlValues()
      element('photo-info').textContent = `${sourcePhotoName} · ${referencePhoto.naturalWidth} × ${referencePhoto.naturalHeight} px · ${config.photoRotationDeg}° CCW · Seitenverhältnis fixiert`
      applyConfig(false)
    }
    referencePhoto.src = photoUrl
  }, 'image/png')
}

function refreshLandmarks(): void {
  const selected=landmarkSelect.value
  landmarkSelect.replaceChildren(...calibrationLandmarks(config.house).map(l=>new Option(l.label,l.id)))
  if([...landmarkSelect.options].some(o=>o.value===selected)) landmarkSelect.value=selected
  updateCalibrationUi()
}

function updateCalibrationUi(): void {
  element('capture-point').classList.toggle('active',calibrationActive)
  element('capture-point').textContent=calibrationActive?'Jetzt ins Foto klicken …':'Punkt im Foto setzen'
  stage.classList.toggle('calibration-active',calibrationActive)
  stage.querySelectorAll('.calibration-marker').forEach(m=>m.remove())
  const names=new Map(calibrationLandmarks(config.house).map(l=>[l.id,l.label]))
  for(const [index,o] of calibrationObservations.entries()){
    const marker=document.createElement('span')
    marker.className='calibration-marker'
    marker.style.left=`${(o.x+1)*50}%`; marker.style.top=`${(1-o.y)*50}%`; marker.textContent=String(index+1)
    stage.append(marker)
  }
  element('calibration-list').textContent=calibrationObservations.map((o,i)=>`${i+1}. ${names.get(o.landmarkId)}`).join(' · ') || 'Noch keine Punkte gesetzt.'
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
