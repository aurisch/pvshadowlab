import type { AppConfig, HouseParameters, PhotoCameraParameters } from './types.ts'
import { calculateHouseGeometry, calculateObstructionCorners, calculateChimney, type Point3 } from './geometry.ts'

export interface CalibrationLandmark { id: string; label: string; point: Point3 }
export interface ReferencePoint extends CalibrationLandmark { objectId: string; objectName: string; source: string }
export type { CalibrationObservation } from './types.ts'

const rad = (degrees: number): number => degrees * Math.PI / 180
const cross = (a: Point3, b: Point3): Point3 => ({ x: a.y*b.z-a.z*b.y, y: a.z*b.x-a.x*b.z, z: a.x*b.y-a.y*b.x })
const dot = (a: Point3, b: Point3): number => a.x*b.x+a.y*b.y+a.z*b.z
const normalize = (v: Point3): Point3 => { const n = Math.hypot(v.x,v.y,v.z); return { x:v.x/n,y:v.y/n,z:v.z/n } }

export function referencePoints(config:AppConfig):ReferencePoint[]{
  const points:ReferencePoint[]=calibrationLandmarks(config.house).map(p=>({...p,objectId:'house',objectName:'Gebäude & Dach',source:'Hausgeometrie / Referenzmaße'}))
  for(const [i,point] of calculateHouseGeometry(config.house).bodyCorners.slice(4).entries()){
    points.push({id:`wall-top-${i}`,label:`Wandoberkante X${point.x<0?'−':'+'} / Z${point.z<0?'−':'+'}`,point,objectId:'house',objectName:'Gebäude & Dach',source:'Hausgeometrie'})
  }
  const labels=['unten links (Traufe)','unten rechts (Traufe)','oben rechts (First)','oben links (First)']
  const ids=['lower-left','lower-right','upper-right','upper-left']
  for(const o of config.roofObstructions){
    const base=calculateObstructionCorners(config.house,o,config.calibration.corrections[o.id])
    for(let i=0;i<4;i++)points.push({id:`${o.id}:${ids[i]}`,label:o.kind==='chimney'?`Dachanschluss ${labels[i]}`:labels[i]!,point:base[i]!,objectId:o.id,objectName:o.name,source:'PV-Plan (Meter) + separat ausgewiesene lokale Korrektur'})
    if(o.kind==='chimney'){
      const {top}=calculateChimney(config.house,o,config.calibration.chimneyTopY,config.calibration.corrections[o.id])
      for(let i=0;i<4;i++)points.push({id:`${o.id}:top-${ids[i]}`,label:`Kaminöffnung ${labels[i]}`,point:top[i]!,objectId:o.id,objectName:o.name,source:'Vertikaler Kamin; absolute waagerechte Oberkante Y'})
    }
  }
  return points
}

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
  return {x:dot(v,right)/(depth*t*c.aspectRatio)+(c.principalX??0),y:dot(v,up)/(depth*t)+(c.principalY??0)}
}
