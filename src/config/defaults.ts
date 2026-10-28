import type { AppConfig } from '../model/types.ts'
import { focalLength35ToVerticalFov } from '../model/cameraMath.ts'
import { IPHONE_11_PRO_PHOTO_REFERENCE } from './photoReference.ts'
import { HOUSE_REFERENCE } from './houseReference.ts'
import { EAST_ROOF_OBSTRUCTIONS } from './roofObstructions.ts'
import { defaultParameters } from '../model/parameters.ts'
import { calculateObstructionCorners } from '../model/geometry.ts'

const referenceAspectRatio = IPHONE_11_PRO_PHOTO_REFERENCE.rotatedWidthPx
  / IPHONE_11_PRO_PHOTO_REFERENCE.rotatedHeightPx

export const DEFAULT_CONFIG: AppConfig = {
  version: 2,
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
    principalX: 0,
    principalY: 0,
  },
  cameraMode: 'free',
  overlayMode: 'overlay',
  modelOpacity: 0.72,
  photoRotationDeg: IPHONE_11_PRO_PHOTO_REFERENCE.requiredRotationDeg,
  calibration: {
    observations: [], parameters: defaultParameters(), corrections: {},
    chimneyTopY: 0, imageWidth: 4032, imageHeight: 3024, robustThresholdPx: 4, migrationNotes: [],
  },
  showCalibrationMarkers: true,
  roofObstructions: structuredClone(EAST_ROOF_OBSTRUCTIONS),
  showObstructionLabels: false,
  lensDistortion: null,
}

DEFAULT_CONFIG.calibration.chimneyTopY=Math.max(...calculateObstructionCorners(DEFAULT_CONFIG.house,EAST_ROOF_OBSTRUCTIONS[0]!).map(p=>p.y))+1.5

export const cloneDefaultConfig = (): AppConfig => structuredClone(DEFAULT_CONFIG)
