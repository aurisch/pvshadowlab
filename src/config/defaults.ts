import type { AppConfig } from '../model/types.ts'
import { focalLength35ToVerticalFov } from '../model/cameraMath.ts'
import { IPHONE_11_PRO_PHOTO_REFERENCE } from './photoReference.ts'

const referenceAspectRatio = IPHONE_11_PRO_PHOTO_REFERENCE.rotatedWidthPx
  / IPHONE_11_PRO_PHOTO_REFERENCE.rotatedHeightPx

export const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  house: {
    width: 9,
    depth: 9,
    eavesHeight: 5,
    roofPitchDeg: 30,
    eaveOverhang: 0.35,
    gableOverhang: 0.35,
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
  lensDistortion: null,
}

export const cloneDefaultConfig = (): AppConfig => structuredClone(DEFAULT_CONFIG)
