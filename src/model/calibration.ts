import type { CalibrationObservation, HouseParameters, ObstructionCalibrationObservation, PhotoCameraParameters, RoofObstruction, RoofObstructionCalibration } from './types.ts'
import { calculateHouseGeometry, calculateObstructionCorners, type Point3 } from './geometry.ts'

export interface CalibrationLandmark { id: string; label: string; point: Point3 }
export type { CalibrationObservation } from './types.ts'
export interface CalibrationResult { camera: PhotoCameraParameters; rmsNormalized: number }

const rad = (degrees: number): number => degrees * Math.PI / 180
const cross = (a: Point3, b: Point3): Point3 => ({ x: a.y*b.z-a.z*b.y, y: a.z*b.x-a.x*b.z, z: a.x*b.y-a.y*b.x })
const dot = (a: Point3, b: Point3): number => a.x*b.x+a.y*b.y+a.z*b.z
const normalize = (v: Point3): Point3 => { const n = Math.hypot(v.x,v.y,v.z); return { x:v.x/n,y:v.y/n,z:v.z/n } }

export function calibrationLandmarks(h: HouseParameters): CalibrationLandmark[] {
  const g = calculateHouseGeometry(h), x=h.width/2, z=h.depth/2
  const roofLeftFront=g.roof.left[0], roofLeftBack=g.roof.left[1]
  const roofRightBack=g.roof.right[2], roofRightFront=g.roof.right[3]
  const ridgeFront=g.roof.left[3], ridgeBack=g.roof.left[2]
  return [
    { id:'base-nw', label:'Grundkante X− / Z−', point:{x:-x,y:0,z:-z} },
    { id:'base-ne', label:'Grundkante X+ / Z−', point:{x:x,y:0,z:-z} },
    { id:'base-sw', label:'Grundkante X− / Z+', point:{x:-x,y:0,z:z} },
    { id:'base-se', label:'Grundkante X+ / Z+', point:{x:x,y:0,z:z} },
    { id:'eave-nw', label:'Äußere Dachecke X− / Z−', point:roofLeftFront },
    { id:'eave-ne', label:'Äußere Dachecke X+ / Z−', point:roofRightFront },
    { id:'eave-sw', label:'Äußere Dachecke X− / Z+', point:roofLeftBack },
    { id:'eave-se', label:'Äußere Dachecke X+ / Z+', point:roofRightBack },
    { id:'ridge-n', label:'Äußeres Firstende Z−', point:ridgeFront },
    { id:'ridge-s', label:'Äußeres Firstende Z+', point:ridgeBack },
  ]
}

export function projectPoint(point: Point3, houseOrientationDeg: number, c: PhotoCameraParameters): {x:number;y:number}|null {
  const a=rad(houseOrientationDeg), ca=Math.cos(a), sa=Math.sin(a)
  const world={x:ca*point.x+sa*point.z,y:point.y,z:-sa*point.x+ca*point.z}
  const az=rad(c.azimuthDeg), el=rad(c.elevationDeg), roll=rad(c.rollDeg)
  const forward=normalize({x:Math.sin(az)*Math.cos(el),y:Math.sin(el),z:Math.cos(az)*Math.cos(el)})
  const right0=normalize(cross(forward,{x:0,y:1,z:0}))
  const up0=cross(right0,forward)
  const right={x:Math.cos(roll)*right0.x+Math.sin(roll)*up0.x,y:Math.cos(roll)*right0.y+Math.sin(roll)*up0.y,z:Math.cos(roll)*right0.z+Math.sin(roll)*up0.z}
  const up={x:-Math.sin(roll)*right0.x+Math.cos(roll)*up0.x,y:-Math.sin(roll)*right0.y+Math.cos(roll)*up0.y,z:-Math.sin(roll)*right0.z+Math.cos(roll)*up0.z}
  const v={x:world.x-c.x,y:world.y-c.y,z:world.z-c.z}, depth=dot(v,forward)
  if(depth<=0.01) return null
  const t=Math.tan(rad(c.verticalFovDeg)/2)
  return {x:dot(v,right)/(depth*t*c.aspectRatio),y:dot(v,up)/(depth*t)}
}

export function optimizeCamera(house: HouseParameters, initial: PhotoCameraParameters, observations: CalibrationObservation[]): CalibrationResult {
  const points=new Map(calibrationLandmarks(house).map(l=>[l.id,l.point]))
  const score=(c:PhotoCameraParameters):number => {
    let sum=0
    for(const o of observations){ const p=points.get(o.landmarkId); if(!p)return 1e9; const q=projectPoint(p,house.orientationDeg,c); if(!q)return 1e9; sum+=(q.x-o.x)**2+(q.y-o.y)**2 }
    return sum/observations.length
  }
  let best={...initial}, bestScore=score(best)
  const keys=(['x','y','z','azimuthDeg','elevationDeg','rollDeg'] as const)
  let steps=[3,3,3,6,4,2]
  for(let pass=0;pass<320;pass++){
    let improved=false
    keys.forEach((key,i)=>{ for(const sign of [-1,1]){ const candidate={...best,[key]:best[key]+sign*(steps[i]??0)}; const s=score(candidate); if(s<bestScore){best=candidate;bestScore=s;improved=true} } })
    if(!improved) steps=steps.map(s=>s*.62)
    if(Math.max(...steps)<0.0005) break
  }
  return {camera:best,rmsNormalized:Math.sqrt(bestScore)}
}

export function optimizeObstructionCalibration(house:HouseParameters,camera:PhotoCameraParameters,obstruction:RoofObstruction,initial:RoofObstructionCalibration,observations:ObstructionCalibrationObservation[]):{calibration:RoofObstructionCalibration;rmsNormalized:number}{
  const indices={ 'lower-left':0,'lower-right':1,'upper-right':2,'upper-left':3 } as const
  const score=(candidate:RoofObstructionCalibration):number=>{
    const corners=calculateObstructionCorners(house,obstruction,candidate)
    let sum=0
    for(const observation of observations){
      const projected=projectPoint(corners[indices[observation.corner]],house.orientationDeg,camera)
      if(!projected)return 1e9
      sum+=(projected.x-observation.x)**2+(projected.y-observation.y)**2
    }
    return sum/observations.length
  }
  let best={...initial,observations:[...observations]},bestScore=score(best)
  const keys=(['alongOffset','slopeOffset','alongScale','slopeScale'] as const)
  let steps=[.5,.5,.08,.08]
  for(let pass=0;pass<240;pass++){
    let improved=false
    keys.forEach((key,index)=>{for(const sign of [-1,1]){const candidate={...best,[key]:best[key]+sign*(steps[index]??0)};if(candidate.alongScale<=.2||candidate.slopeScale<=.2)continue;const value=score(candidate);if(value<bestScore){best=candidate;bestScore=value;improved=true}}})
    if(!improved)steps=steps.map(step=>step*.62)
    if(Math.max(...steps)<.00005)break
  }
  return {calibration:best,rmsNormalized:Math.sqrt(bestScore)}
}

export function optimizeChimneyHeight(house:HouseParameters,camera:PhotoCameraParameters,chimney:RoofObstruction,calibration:RoofObstructionCalibration,observations:ObstructionCalibrationObservation[]):{height:number;rmsNormalized:number}{
  const base=calculateObstructionCorners(house,chimney,calibration)
  const roofTop=Math.max(...base.map(point=>point.y))
  const score=(height:number):number=>{
    let sum=0
    for(const observation of observations){
      const isLeft=observation.corner==='lower-left'||observation.corner==='upper-left'
      const isTop=observation.corner==='upper-left'||observation.corner==='upper-right'
      const source=base[isLeft?0:1]
      const projected=projectPoint(
        isTop?{x:source.x,y:roofTop+height,z:source.z}:source,
        house.orientationDeg,camera,
      )
      if(!projected)return 1e9
      sum+=(projected.x-observation.x)**2+(projected.y-observation.y)**2
    }
    return sum/observations.length
  }
  let height=calibration.chimneyHeight,best=score(height),step=.5
  for(let pass=0;pass<100;pass++){
    let improved=false
    for(const sign of [-1,1]){const candidate=Math.max(.05,height+sign*step),value=score(candidate);if(value<best){height=candidate;best=value;improved=true}}
    if(!improved)step*=.55
    if(step<.0001)break
  }
  return {height,rmsNormalized:Math.sqrt(best)}
}
