import type { AppConfig } from '../model/types.ts'
import { focalLength35ToVerticalFov } from '../model/cameraMath.ts'
import { IPHONE_11_PRO_PHOTO_REFERENCE } from './photoReference.ts'
import { HOUSE_REFERENCE } from './houseReference.ts'
import { EAST_ROOF_OBSTRUCTIONS } from './roofObstructions.ts'

const referenceAspectRatio = IPHONE_11_PRO_PHOTO_REFERENCE.rotatedWidthPx
  / IPHONE_11_PRO_PHOTO_REFERENCE.rotatedHeightPx

export const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  houseReferenceRevision: HOUSE_REFERENCE.revision,
  house: {
    width: HOUSE_REFERENCE.buildingWidthM,
    depth: HOUSE_REFERENCE.buildingDepthM,
    eavesHeight: 5,
    roofPitchDeg: HOUSE_REFERENCE.roofPitchDeg,
    eaveOverhang: HOUSE_REFERENCE.eaveOverhangM,
    gableOverhang: HOUSE_REFERENCE.gableOverhangM,
    orientationDeg: 0,
  },
  photoCamera: {
    x: 12,
    y: 8,
    z: 14,
    azimuthDeg: -140,
    elevationDeg: -24,
    rollDeg: 0,
    verticalFovDeg: focalLength35ToVerticalFov(
      IPHONE_11_PRO_PHOTO_REFERENCE.equivalentFocalLength35Mm,
      referenceAspectRatio,
    ),
    aspectRatio: referenceAspectRatio,
  },
  cameraMode: 'free',
  overlayMode: 'overlay',
  modelOpacity: 0.72,
  photoRotationDeg: IPHONE_11_PRO_PHOTO_REFERENCE.requiredRotationDeg,
  calibrationObservations: [],
  showCalibrationMarkers: true,
  roofObstructions: structuredClone(EAST_ROOF_OBSTRUCTIONS),
  showObstructionLabels: false,
  roofObstructionCalibration: {alongOffset:0,slopeOffset:0,alongScale:1,slopeScale:1,observations:[],chimneyHeight:1.5,chimneyObservations:[]},
  useRoofObstructionCalibration: false,
  lensDistortion: null,
}

export const cloneDefaultConfig = (): AppConfig => structuredClone(DEFAULT_CONFIG)
