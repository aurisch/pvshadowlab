import './style.css'
import { SceneController } from './scene/SceneController.ts'
import { cloneDefaultConfig } from './config/defaults.ts'
import { exportConfig, importConfig } from './config/serialization.ts'
import { focalLength35ToVerticalFov, verticalFovToFocalLength35 } from './model/cameraMath.ts'
import type { AppConfig, CameraMode, OverlayMode } from './model/types.ts'
import { cameraControls, derivedText, getPath, houseControls, setPath, type NumericControlSpec } from './ui/controls.ts'

const STORAGE_KEY = 'pv-shadowlab-config-v1'
let config = loadSavedConfig()
let photoUrl: string | null = null

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
        <div class="segmented" role="group" aria-label="Darstellung">
          <button data-overlay="photo">Foto</button><button data-overlay="model">Modell</button><button data-overlay="overlay">Beides</button>
        </div>
        <label class="slider-row"><span>Modelldeckkraft</span><input id="opacity" type="range" min="0" max="1" step="0.01"><output id="opacity-value"></output></label>
        <p id="photo-info" class="hint">Kein Foto geladen. Die Datei bleibt ausschließlich lokal.</p>
      </details>
      <details><summary>Konfiguration</summary>
        <div class="button-grid"><button id="export-config">JSON exportieren</button><label class="file-button">JSON importieren<input id="import-config" type="file" accept="application/json,.json"></label></div>
        <p id="status" class="status" role="status"></p>
      </details>
    </aside>
    <section id="workspace">
      <div id="stage">
        <img id="reference-photo" alt="Lokales Referenzfoto des Hauses">
        <div id="viewport"></div>
        <div id="empty-photo" class="empty-photo">Fotokamera aktiv · Referenzfoto links auswählen</div>
      </div>
      <div class="axis-note">X Breite · Y Höhe · Z Tiefe · Einheit Meter</div>
    </section>
  </main>`

const viewport = element<HTMLDivElement>('viewport')
const stage = element<HTMLDivElement>('stage')
const referencePhoto = element<HTMLImageElement>('reference-photo')
const scene = new SceneController(viewport, config)

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
  if (photoUrl) URL.revokeObjectURL(photoUrl)
  photoUrl = URL.createObjectURL(file)
  referencePhoto.onload = () => {
    config.photoCamera.aspectRatio = referencePhoto.naturalWidth / referencePhoto.naturalHeight
    config.cameraMode = 'photo'
    syncControlValues()
    element('photo-info').textContent = `${file.name} · ${referencePhoto.naturalWidth} × ${referencePhoto.naturalHeight} px · natives Seitenverhältnis fixiert`
    applyConfig(false)
  }
  referencePhoto.src = photoUrl
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

updateUiState()
