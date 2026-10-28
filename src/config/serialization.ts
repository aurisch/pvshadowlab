import type { AppConfig } from '../model/types.ts'
import { validateHouseParameters } from '../model/geometry.ts'
import { EAST_ROOF_OBSTRUCTIONS } from './roofObstructions.ts'

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
  const calibrationObservations = Array.isArray(candidate.calibrationObservations)
    ? candidate.calibrationObservations.filter((observation) =>
      observation && typeof observation.landmarkId === 'string'
      && typeof observation.x === 'number' && Number.isFinite(observation.x)
      && typeof observation.y === 'number' && Number.isFinite(observation.y),
    ).map(({ landmarkId, x, y }) => ({ landmarkId, x, y }))
    : []
  const roofCalibration=candidate.roofObstructionCalibration
  const validRoofNumber=(value:unknown,fallback:number)=>typeof value==='number'&&Number.isFinite(value)?value:fallback
  return {
    version: 1,
    houseReferenceRevision: typeof candidate.houseReferenceRevision === 'number' ? candidate.houseReferenceRevision : 0,
    house: { ...candidate.house },
    photoCamera: { ...c },
    cameraMode: candidate.cameraMode === 'photo' ? 'photo' : 'free',
    overlayMode: candidate.overlayMode === 'photo' || candidate.overlayMode === 'model' ? candidate.overlayMode : 'overlay',
    modelOpacity: typeof candidate.modelOpacity === 'number' ? Math.min(1, Math.max(0, candidate.modelOpacity)) : 0.72,
    photoRotationDeg: candidate.photoRotationDeg === 0 || candidate.photoRotationDeg === 180 || candidate.photoRotationDeg === 270
      ? candidate.photoRotationDeg
      : 90,
    calibrationObservations,
    showCalibrationMarkers: candidate.showCalibrationMarkers !== false,
    roofObstructions: Array.isArray(candidate.roofObstructions)
      ? structuredClone(candidate.roofObstructions).filter((obstruction) => obstruction.id !== 'east-02')
        .map((obstruction) => ({ ...obstruction, normalOffset: 0 }))
      : structuredClone(EAST_ROOF_OBSTRUCTIONS),
    showObstructionLabels: candidate.showObstructionLabels === true,
    roofObstructionCalibration:{
      alongOffset:validRoofNumber(roofCalibration?.alongOffset,0),
      slopeOffset:validRoofNumber(roofCalibration?.slopeOffset,0),
      alongScale:validRoofNumber(roofCalibration?.alongScale,1),
      slopeScale:validRoofNumber(roofCalibration?.slopeScale,1),
      observations:Array.isArray(roofCalibration?.observations)
        ? roofCalibration.observations.filter(o=>o&&['lower-left','lower-right','upper-right','upper-left'].includes(o.corner)&&Number.isFinite(o.x)&&Number.isFinite(o.y))
        : [],
      chimneyHeight:validRoofNumber(roofCalibration?.chimneyHeight,1.5),
      chimneyObservations:Array.isArray(roofCalibration?.chimneyObservations)
        ? roofCalibration.chimneyObservations.filter(o=>o&&['lower-left','lower-right','upper-right','upper-left'].includes(o.corner)&&Number.isFinite(o.x)&&Number.isFinite(o.y))
        : [],
    },
    useRoofObstructionCalibration:candidate.useRoofObstructionCalibration===true,
    lensDistortion: null,
  }
}
