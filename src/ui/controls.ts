import type { AppConfig } from '../model/types.ts'
import { calculateHouseGeometry } from '../model/geometry.ts'
import { verticalFovToFocalLength35 } from '../model/cameraMath.ts'

export interface NumericControlSpec {
  path: string
  label: string
  min: number
  max: number
  step: number
  unit?: string
}

export const houseControls: NumericControlSpec[] = [
  { path: 'house.width', label: 'Gebäudebreite', min: 1, max: 30, step: 0.05, unit: 'm' },
  { path: 'house.depth', label: 'Gebäudetiefe', min: 1, max: 30, step: 0.05, unit: 'm' },
  { path: 'house.eavesHeight', label: 'Traufhöhe', min: 1, max: 15, step: 0.05, unit: 'm' },
  { path: 'house.roofPitchDeg', label: 'Dachneigung', min: 1, max: 70, step: 0.1, unit: '°' },
  { path: 'house.eaveOverhang', label: 'Traufüberstand', min: 0, max: 3, step: 0.01, unit: 'm' },
  { path: 'house.gableOverhang', label: 'Giebelüberstand', min: 0, max: 3, step: 0.01, unit: 'm' },
  { path: 'house.orientationDeg', label: 'Ausrichtung', min: -180, max: 180, step: 0.5, unit: '°' },
]

export const cameraControls: NumericControlSpec[] = [
  { path: 'photoCamera.x', label: 'Position X', min: -50, max: 50, step: 0.05, unit: 'm' },
  { path: 'photoCamera.y', label: 'Position Y', min: -5, max: 40, step: 0.05, unit: 'm' },
  { path: 'photoCamera.z', label: 'Position Z', min: -50, max: 50, step: 0.05, unit: 'm' },
  { path: 'photoCamera.azimuthDeg', label: 'Azimut', min: -180, max: 180, step: 0.1, unit: '°' },
  { path: 'photoCamera.elevationDeg', label: 'Elevation', min: -89, max: 89, step: 0.1, unit: '°' },
  { path: 'photoCamera.rollDeg', label: 'Rollwinkel', min: -45, max: 45, step: 0.1, unit: '°' },
  { path: 'photoCamera.verticalFovDeg', label: 'Vertikaler FOV', min: 10, max: 120, step: 0.1, unit: '°' },
  { path: 'photoCamera.aspectRatio', label: 'Seitenverhältnis', min: 0.4, max: 3, step: 0.001 },
]

export function getPath(config: AppConfig, path: string): number {
  const [group, key] = path.split('.') as ['house' | 'photoCamera', string]
  return (config[group] as unknown as Record<string, number>)[key] ?? 0
}

export function setPath(config: AppConfig, path: string, value: number): void {
  const [group, key] = path.split('.') as ['house' | 'photoCamera', string]
  ;(config[group] as unknown as Record<string, number>)[key] = value
}

export function derivedText(config: AppConfig): string {
  const { ridgeHeight } = calculateHouseGeometry(config.house)
  const focal = verticalFovToFocalLength35(config.photoCamera.verticalFovDeg, config.photoCamera.aspectRatio)
  return `Firsthöhe: ${ridgeHeight.toFixed(2)} m · 35-mm-äquiv.: ${focal.toFixed(1)} mm`
}
