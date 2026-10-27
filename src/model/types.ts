export interface HouseParameters {
  width: number
  depth: number
  eavesHeight: number
  roofPitchDeg: number
  eaveOverhang: number
  gableOverhang: number
  orientationDeg: number
}

export interface PhotoCameraParameters {
  x: number
  y: number
  z: number
  azimuthDeg: number
  elevationDeg: number
  rollDeg: number
  verticalFovDeg: number
  aspectRatio: number
}

export type CameraMode = 'free' | 'photo'
export type OverlayMode = 'photo' | 'model' | 'overlay'

export interface AppConfig {
  version: 1
  house: HouseParameters
  photoCamera: PhotoCameraParameters
  cameraMode: CameraMode
  overlayMode: OverlayMode
  modelOpacity: number
  lensDistortion: null
}
