import type { AppConfig } from './types.ts'
import { focalLength35ToVerticalFov, verticalFovToFocalLength35 } from './cameraMath.ts'

/** Rotate the image, its observations and the calibrated camera together. */
export function rotateCalibration(config:AppConfig,deltaDeg:number):void{
  const turns=((Math.round(deltaDeg/90)%4)+4)%4
  const focal=verticalFovToFocalLength35(config.photoCamera.verticalFovDeg,config.photoCamera.aspectRatio)
  for(let i=0;i<turns;i++){
    config.calibration.observations.forEach(o=>{const x=o.x;o.x=-o.y;o.y=x})
    const c=config.photoCamera,x=c.principalX
    c.principalX=-c.principalY;c.principalY=x;c.rollDeg-=90;c.aspectRatio=1/c.aspectRatio
    ;[config.calibration.imageWidth,config.calibration.imageHeight]=[config.calibration.imageHeight,config.calibration.imageWidth]
  }
  config.photoCamera.rollDeg=((config.photoCamera.rollDeg+180)%360+360)%360-180
  config.photoCamera.verticalFovDeg=focalLength35ToVerticalFov(focal,config.photoCamera.aspectRatio)
  config.photoRotationDeg=((config.photoRotationDeg+deltaDeg+360)%360) as AppConfig['photoRotationDeg']
}
