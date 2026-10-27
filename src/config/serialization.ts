import type { AppConfig } from '../model/types.ts'
import { validateHouseParameters } from '../model/geometry.ts'

export function exportConfig(config: AppConfig): string {
  return JSON.stringify(config, null, 2)
}

export function importConfig(json: string): AppConfig {
  const value: unknown = JSON.parse(json)
  if (!value || typeof value !== 'object') throw new Error('Konfiguration muss ein JSON-Objekt sein.')
  const candidate = value as Partial<AppConfig>
  if (candidate.version !== 1 || !candidate.house || !candidate.photoCamera) throw new Error('Nicht unterstützte Konfiguration.')
  const errors = validateHouseParameters(candidate.house)
  if (errors.length) throw new Error(errors.join(' '))
  const c = candidate.photoCamera
  const numbers = [c.x, c.y, c.z, c.azimuthDeg, c.elevationDeg, c.rollDeg, c.verticalFovDeg, c.aspectRatio]
  if (numbers.some((number) => typeof number !== 'number' || !Number.isFinite(number))) throw new Error('Ungültige Kameraparameter.')
  if (c.verticalFovDeg <= 1 || c.verticalFovDeg >= 179 || c.aspectRatio <= 0) throw new Error('Ungültiger Bildwinkel oder Seitenverhältnis.')
  return {
    version: 1,
    house: { ...candidate.house },
    photoCamera: { ...c },
    cameraMode: candidate.cameraMode === 'photo' ? 'photo' : 'free',
    overlayMode: candidate.overlayMode === 'photo' || candidate.overlayMode === 'model' ? candidate.overlayMode : 'overlay',
    modelOpacity: typeof candidate.modelOpacity === 'number' ? Math.min(1, Math.max(0, candidate.modelOpacity)) : 0.72,
    photoRotationDeg: candidate.photoRotationDeg === 0 || candidate.photoRotationDeg === 180 || candidate.photoRotationDeg === 270
      ? candidate.photoRotationDeg
      : 90,
    lensDistortion: null,
  }
}
