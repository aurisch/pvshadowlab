import { describe,expect,it } from 'vitest'
import { calibrationLandmarks,optimizeCamera,projectPoint } from '../src/model/calibration.ts'
import { DEFAULT_CONFIG } from '../src/config/defaults.ts'
import * as THREE from 'three'

describe('Punktkalibrierung',()=>{
  it('rekonstruiert eine Kamerapose aus Modellpunkten',()=>{
    const house={...DEFAULT_CONFIG.house,orientationDeg:15}
    const target={...DEFAULT_CONFIG.photoCamera,x:10,y:4,z:22,azimuthDeg:-155,elevationDeg:-6,rollDeg:1}
    const observations=calibrationLandmarks(house).slice(0,8).map(l=>({landmarkId:l.id,...projectPoint(l.point,house.orientationDeg,target)!}))
    const initial={...target,x:12,y:3,z:25,azimuthDeg:-150,elevationDeg:-3,rollDeg:0}
    const result=optimizeCamera(house,initial,observations)
    expect(result.rmsNormalized).toBeLessThan(0.003)
  })

  it('entspricht der Three.js-Kameraprojektion einschließlich Rollwinkel',()=>{
    const camera={...DEFAULT_CONFIG.photoCamera,x:7,y:5,z:18,azimuthDeg:-160,elevationDeg:-8,rollDeg:3}
    const point={x:2,y:4,z:3}, orientation=22
    const expectedCamera=new THREE.PerspectiveCamera(camera.verticalFovDeg,camera.aspectRatio,0.05,1000)
    expectedCamera.position.set(camera.x,camera.y,camera.z)
    const az=THREE.MathUtils.degToRad(camera.azimuthDeg), el=THREE.MathUtils.degToRad(camera.elevationDeg)
    const direction=new THREE.Vector3(Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el))
    expectedCamera.lookAt(expectedCamera.position.clone().add(direction))
    expectedCamera.rotateZ(THREE.MathUtils.degToRad(camera.rollDeg))
    expectedCamera.updateMatrixWorld()
    const world=new THREE.Vector3(point.x,point.y,point.z).applyAxisAngle(new THREE.Vector3(0,1,0),THREE.MathUtils.degToRad(orientation))
    const expected=world.project(expectedCamera)
    const actual=projectPoint(point,orientation,camera)!
    expect(actual.x).toBeCloseTo(expected.x,8)
    expect(actual.y).toBeCloseTo(expected.y,8)
  })
})
