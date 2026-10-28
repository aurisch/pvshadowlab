import { describe, expect, it } from 'vitest'
import { focalLength35ToVerticalFov, verticalFovToFocalLength35 } from '../src/model/cameraMath.ts'
import { IPHONE_11_PRO_PHOTO_REFERENCE } from '../src/config/photoReference.ts'
import { cloneDefaultConfig } from '../src/config/defaults.ts'
import { rotateCalibration } from '../src/model/photoTransform.ts'
import { projectPoint } from '../src/model/calibration.ts'

describe('Kameraoptik', () => {
  it('rechnet 35-mm-äquivalente Brennweite und vertikalen FOV verlustarm um', () => {
    const fov = focalLength35ToVerticalFov(26, 4 / 3)
    expect(fov).toBeCloseTo(53.06, 1)
    expect(verticalFovToFocalLength35(fov, 4 / 3)).toBeCloseTo(26, 8)
  })

  it('leitet den vertikalen FOV der dargestellten 4:3-Referenzaufnahme ab', () => {
    const aspect = IPHONE_11_PRO_PHOTO_REFERENCE.rotatedWidthPx / IPHONE_11_PRO_PHOTO_REFERENCE.rotatedHeightPx
    expect(focalLength35ToVerticalFov(26, aspect)).toBeCloseTo(53.060, 3)
  })

  it('dreht Bildpunkte, Bildformat und Kamera ohne Projektionsverlust gemeinsam',()=>{
    const config=cloneDefaultConfig(),point={x:2,y:4,z:3}
    config.photoCamera.principalX=.1;config.photoCamera.principalY=-.04
    const original=projectPoint(point,config.house.orientationDeg,config.photoCamera)!
    config.calibration.observations=[{pointId:'test',...original,active:true,weight:1}]
    const before=structuredClone(config)
    rotateCalibration(config,90)
    const rotated=projectPoint(point,config.house.orientationDeg,config.photoCamera)!
    expect(rotated.x).toBeCloseTo(-original.y,9);expect(rotated.y).toBeCloseTo(original.x,9)
    expect(config.calibration.observations[0]!.x).toBeCloseTo(rotated.x,9)
    expect(config.calibration.imageWidth).toBe(before.calibration.imageHeight)
    rotateCalibration(config,-90)
    expect(config.photoCamera.verticalFovDeg).toBeCloseTo(before.photoCamera.verticalFovDeg,9)
    expect(config.photoCamera.rollDeg).toBe(before.photoCamera.rollDeg)
    expect(config.calibration.observations).toEqual(before.calibration.observations)
  })
})
