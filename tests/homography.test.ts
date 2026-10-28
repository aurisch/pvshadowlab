import { describe,expect,it } from 'vitest'
import { applyHomography,calculateHomography,invertHomography,roofMetricCorners } from '../src/model/homography.ts'
import { DRONE_DIMENSIONS,measureDroneObject } from '../src/model/droneMeasurement.ts'
import { DEFAULT_CONFIG } from '../src/config/defaults.ts'

describe('Dach-Homographie',()=>{
  const source=[{x:137,y:621},{x:934,y:573},{x:791,y:181},{x:246,y:212}]
  const target=roofMetricCorners(10.83,6.24)
  it('bildet vier perspektivische Dachecken exakt auf metrische Koordinaten ab',()=>{
    const h=calculateHomography(source,target)
    source.forEach((point,index)=>expect(applyHomography(h,point)).toEqual(expect.objectContaining({x:expect.closeTo(target[index]!.x,8),y:expect.closeTo(target[index]!.y,8)})))
  })
  it('ist in beiden Richtungen numerisch konsistent',()=>{
    const h=calculateHomography(source,target),inverse=invertHomography(h)
    for(const point of [{x:400,y:300},{x:700,y:420},{x:300,y:550}]){
      const roundtrip=applyHomography(inverse,applyHomography(h,point))
      expect(roundtrip.x).toBeCloseTo(point.x,8);expect(roundtrip.y).toBeCloseTo(point.y,8)
    }
  })
  it('weist kollineare oder zu kleine Referenzflächen verständlich zurück',()=>{
    expect(()=>calculateHomography([{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:3,y:0}],target)).toThrow(/ungeeignet|Fläche/)
    expect(()=>roofMetricCorners(0,6)).toThrow('positiv')
  })
  it('rekonstruiert synthetische Objektkoordinaten und Differenzen zum PV-Plan',()=>{
    const h=calculateHomography(source,target),inverse=invertHomography(h),obstruction=DEFAULT_CONFIG.roofObstructions.find(o=>o.id==='east-04')!
    const metric=[{x:8.115,y:3.504},{x:8.952,y:3.504},{x:8.952,y:4.580},{x:8.115,y:4.580}]
    const image=metric.map(p=>applyHomography(inverse,p))
    const result=measureDroneObject(h,source,image,DRONE_DIMENSIONS[1]!,obstruction,2)
    expect(result.measured.xMin).toBeCloseTo(8.115,8)
    expect(result.differencesCm.centerX).toBeCloseTo(10,8)
    expect(result.differencesCm.centerY).toBeCloseTo(-5,8)
    expect(result.differencesCm.width).toBeCloseTo(0,8)
    expect(result.uncertaintyCm).toBeGreaterThan(0)
  })
  it('hält X entlang der Traufe und Y von Traufe zu First',()=>{
    const h=calculateHomography(source,target)
    expect(applyHomography(h,source[0]!)).toEqual(expect.objectContaining({x:expect.closeTo(0,8),y:expect.closeTo(0,8)}))
    expect(applyHomography(h,source[1]!)).toEqual(expect.objectContaining({x:expect.closeTo(10.83,8),y:expect.closeTo(0,8)}))
    expect(applyHomography(h,source[3]!)).toEqual(expect.objectContaining({x:expect.closeTo(0,8),y:expect.closeTo(6.24,8)}))
  })
})
