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
  principalX: number
  principalY: number
}

export type CameraMode = 'free' | 'photo'
export type OverlayMode = 'photo' | 'model' | 'overlay'
export interface CalibrationObservation { pointId: string; x: number; y: number; active: boolean; weight: number }
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
export interface ObjectCorrection {
  alongOffset:number
  slopeOffset:number
  alongScale:number
  slopeScale:number
}

export interface ParameterSetting { id: string; enabled: boolean; min: number; max: number }
export interface JointCalibration {
  observations: CalibrationObservation[]
  parameters: ParameterSetting[]
  corrections: Record<string, ObjectCorrection>
  chimneyTopY: number
  imageWidth: number
  imageHeight: number
  robustThresholdPx: number
  migrationNotes: string[]
  legacyConfig?: string
}

export interface AppConfig {
  version: 2
  houseReferenceRevision: number
  house: HouseParameters
  photoCamera: PhotoCameraParameters
  cameraMode: CameraMode
  overlayMode: OverlayMode
  modelOpacity: number
  photoRotationDeg: 0 | 90 | 180 | 270
  calibration: JointCalibration
  showCalibrationMarkers: boolean
  roofObstructions: RoofObstruction[]
  showObstructionLabels: boolean
  lensDistortion: null
}
