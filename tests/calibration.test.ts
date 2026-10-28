import { describe,expect,it } from 'vitest'
import * as THREE from 'three'
import { referencePoints,projectPoint } from '../src/model/calibration.ts'
import { optimizeJoint,calibrationDiagnostics } from '../src/model/jointCalibration.ts'
import { cloneDefaultConfig } from '../src/config/defaults.ts'
import { applyPhotoCamera } from '../src/scene/photoCamera.ts'
import type { AppConfig } from '../src/model/types.ts'

function synthetic(){
  const target=cloneDefaultConfig()
  target.house.orientationDeg=15
  target.photoCamera={...target.photoCamera,x:10,y:4,z:22,azimuthDeg:-155,elevationDeg:-6,rollDeg:1}
  target.calibration.observations=referencePoints(target).map(p=>({pointId:p.id,...projectPoint(p.point,target.house.orientationDeg,target.photoCamera)!,active:true,weight:1}))
  const initial=structuredClone(target)
  Object.assign(initial.photoCamera,{x:12,y:3,z:25,azimuthDeg:-150,elevationDeg:-3,rollDeg:0})
  return {target,initial}
}
function free(config:AppConfig,...ids:string[]){config.calibration.parameters.forEach(p=>p.enabled=ids.includes(p.id))}

describe('Gemeinsame Kalibrierung',()=>{
  it('rekonstruiert die bekannte Kamera bei fixierter Geometrie deterministisch',()=>{
    const {target,initial}=synthetic(),before=structuredClone(initial)
    const result=optimizeJoint(initial)
    expect(result.accepted,result.status).toBe(true)
    expect(result.rmsPx).toBeLessThan(.001)
    for(const key of ['x','y','z','azimuthDeg','elevationDeg','rollDeg'] as const)expect(result.config.photoCamera[key]).toBeCloseTo(target.photoCamera[key],4)
    expect(result.config.house).toEqual(target.house)
    expect(result.warnings).toEqual([])
    expect(initial).toEqual(before)
    expect(optimizeJoint(initial)).toEqual(result)
  })
  it('behandelt einen einzelnen groben Ausreißer robust',()=>{
    const {initial}=synthetic()
    initial.calibration.observations[0]!.x+=.15
    initial.calibration.observations[0]!.y-=.12
    const result=optimizeJoint(initial)
    expect(result.accepted,result.status).toBe(true)
    const good=result.points.slice(1)
    expect(Math.sqrt(good.reduce((s,p)=>s+p.errorPx**2,0)/good.length)).toBeLessThan(1)
    expect(result.points[0]!.robustWeight).toBeLessThan(.03)
    expect(result.warnings.join(' ')).toContain('Einzelabweichungen')
  })
  it('respektiert Parametergrenzen und gesperrte Parameter',()=>{
    const {target,initial}=synthetic()
    initial.photoCamera={...target.photoCamera,x:target.photoCamera.x+1}
    free(initial,'photoCamera.x')
    const p=initial.calibration.parameters.find(p=>p.id==='photoCamera.x')!
    p.min=target.photoCamera.x+.3;p.max=target.photoCamera.x+2
    const result=optimizeJoint(initial)
    expect(result.accepted,result.status).toBe(true)
    expect(result.config.photoCamera.x).toBeCloseTo(p.min,5)
    expect(result.config.photoCamera.y).toBe(initial.photoCamera.y)
    expect(result.warnings.join(' ')).toContain('Grenze')
  })
  it('ändert bei unzureichenden oder nicht beobachtbaren Daten keinen Stand',()=>{
    const {initial}=synthetic()
    initial.calibration.observations=initial.calibration.observations.slice(0,2)
    expect(optimizeJoint(initial).config).toEqual(initial)
    expect(optimizeJoint(initial).accepted).toBe(false)
    const all=synthetic().initial
    free(all,'photoCamera.y','house.eavesHeight')
    all.calibration.observations=all.calibration.observations.filter(p=>p.pointId.startsWith('eave-')||p.pointId.startsWith('ridge-'))
    const result=optimizeJoint(all)
    expect(result.accepted).toBe(false)
    expect(result.status).toContain('nicht eindeutig')
    expect(result.config).toEqual(all)
  })
  it('ignoriert deaktivierte Punkte und berücksichtigt Messgewichte',()=>{
    const {target}=synthetic()
    free(target,'photoCamera.x')
    target.calibration.observations[0]!.active=false
    target.calibration.observations[0]!.x=100
    target.calibration.observations[1]!.weight=.01
    const result=optimizeJoint(target)
    expect(result.accepted).toBe(true)
    expect(result.rmsPx).toBeLessThan(1e-7)
    expect(result.activeCount).toBe(target.calibration.observations.length-1)
  })
  it('optimiert lokale Fensterkorrekturen und absolute Kaminoberkante gemeinsam',()=>{
    const {target}=synthetic()
    target.calibration.corrections['east-04']={alongOffset:.13,slopeOffset:-.11,alongScale:1.08,slopeScale:.94}
    target.calibration.chimneyTopY+=.4
    target.calibration.observations=referencePoints(target).map(p=>({pointId:p.id,...projectPoint(p.point,target.house.orientationDeg,target.photoCamera)!,active:true,weight:1}))
    const initial=structuredClone(target)
    initial.calibration.corrections={};initial.calibration.chimneyTopY-=.4
    free(initial,'correction.east-04.alongOffset','correction.east-04.slopeOffset','correction.east-04.alongScale','correction.east-04.slopeScale','calibration.chimneyTopY')
    const result=optimizeJoint(initial)
    expect(result.accepted,result.status).toBe(true)
    expect(result.rmsPx).toBeLessThan(.001)
    expect(result.config.calibration.chimneyTopY).toBeCloseTo(target.calibration.chimneyTopY,5)
    expect(result.config.roofObstructions).toEqual(target.roofObstructions)
  })
  it('berechnet Pixelabstände getrennt für Bildbreite und Bildhöhe',()=>{
    const {target}=synthetic()
    target.calibration.observations=target.calibration.observations.slice(0,1)
    target.calibration.observations[0]!.x+=2/target.calibration.imageWidth*3
    target.calibration.observations[0]!.y+=2/target.calibration.imageHeight*4
    expect(calibrationDiagnostics(target).rmsPx).toBeCloseTo(5,8)
  })

  it('rekonstruiert optional freigegebene Optik aus räumlich verteilten Punkten',()=>{
    const {target}=synthetic()
    target.photoCamera.verticalFovDeg+=3
    target.photoCamera.principalX=.04;target.photoCamera.principalY=-.03
    target.calibration.observations=referencePoints(target).map(p=>({pointId:p.id,...projectPoint(p.point,target.house.orientationDeg,target.photoCamera)!,active:true,weight:1}))
    const initial=structuredClone(target)
    initial.photoCamera.verticalFovDeg-=2;initial.photoCamera.principalX=0;initial.photoCamera.principalY=0
    free(initial,'photoCamera.x','photoCamera.y','photoCamera.z','photoCamera.azimuthDeg','photoCamera.elevationDeg','photoCamera.rollDeg','photoCamera.verticalFovDeg','photoCamera.principalX','photoCamera.principalY')
    const result=optimizeJoint(initial)
    expect(result.accepted,result.status).toBe(true)
    expect(result.rmsPx).toBeLessThan(.001)
    expect(result.config.photoCamera.verticalFovDeg).toBeCloseTo(target.photoCamera.verticalFovDeg,4)
    expect(result.config.photoCamera.principalX).toBeCloseTo(target.photoCamera.principalX,5)
  })

  it('weist unsichtbare Punkte und widersprüchliche Grenzen ohne Änderung zurück',()=>{
    const {initial}=synthetic()
    initial.photoCamera.azimuthDeg+=180
    const behind=optimizeJoint(initial)
    expect(behind.accepted).toBe(false);expect(behind.config).toEqual(initial)
    initial.calibration.parameters[0]!.min=101;initial.calibration.parameters[0]!.max=100
    expect(optimizeJoint(initial).status).toContain('Parametergrenzen')
  })
})

describe('Mathematische Projektion / tatsächliche Three.js-Kamera',()=>{
  for(const aspect of [4/3,3/4,16/9])for(const roll of [-23,0,17]){
    it(`entspricht Three.js bei Format ${aspect} und Roll ${roll}`,()=>{
      const c={...cloneDefaultConfig().photoCamera,x:7,y:5,z:18,azimuthDeg:-160,elevationDeg:-8,rollDeg:roll,aspectRatio:aspect,principalX:.08,principalY:-.06}
      const camera=new THREE.PerspectiveCamera()
      applyPhotoCamera(camera,c)
      for(const orientation of [0,22,-91])for(const point of [{x:2,y:4,z:3},{x:-3,y:0,z:-4},{x:1,y:9,z:1}]){
        const world=new THREE.Vector3(point.x,point.y,point.z).applyAxisAngle(new THREE.Vector3(0,1,0),THREE.MathUtils.degToRad(orientation))
        const expected=world.project(camera),actual=projectPoint(point,orientation,c)!
        expect(actual.x).toBeCloseTo(expected.x,9);expect(actual.y).toBeCloseTo(expected.y,9)
      }
    })
  }
  it('weist Punkte hinter der Kamera zurück',()=>{
    const c={...cloneDefaultConfig().photoCamera,x:0,y:0,z:0,azimuthDeg:0,elevationDeg:0}
    expect(projectPoint({x:0,y:0,z:-1},0,c)).toBeNull()
  })
})
