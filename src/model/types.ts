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
export interface CalibrationObservation { landmarkId: string; x: number; y: number }
export interface RoofObstruction {
  id: string
  name: string
  roof: 'east'
  alongMin: number
  alongMax: number
  slopeMin: number
  slopeMax: number
  normalOffset: number
  kind: 'chimney' | 'window' | 'vent'
}
export type ObstructionCorner = 'lower-left'|'lower-right'|'upper-right'|'upper-left'
export interface ObstructionCalibrationObservation { corner:ObstructionCorner; x:number; y:number }
export interface RoofObstructionCalibration {
  alongOffset:number
  slopeOffset:number
  alongScale:number
  slopeScale:number
  observations:ObstructionCalibrationObservation[]
  chimneyHeight:number
  chimneyObservations:ObstructionCalibrationObservation[]
}

export interface AppConfig {
  version: 1
  houseReferenceRevision: number
  house: HouseParameters
  photoCamera: PhotoCameraParameters
  cameraMode: CameraMode
  overlayMode: OverlayMode
  modelOpacity: number
  photoRotationDeg: 0 | 90 | 180 | 270
  calibrationObservations: CalibrationObservation[]
  showCalibrationMarkers: boolean
  roofObstructions: RoofObstruction[]
  showObstructionLabels: boolean
  roofObstructionCalibration: RoofObstructionCalibration
  useRoofObstructionCalibration: boolean
  lensDistortion: null
}
