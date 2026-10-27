import type { AppConfig } from '../model/types.ts'

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
    verticalFovDeg: 50,
    aspectRatio: 4 / 3,
  },
  cameraMode: 'free',
  overlayMode: 'overlay',
  modelOpacity: 0.72,
  lensDistortion: null,
}

export const cloneDefaultConfig = (): AppConfig => structuredClone(DEFAULT_CONFIG)
