import type { RoofObstruction } from './types.ts'
import { applyHomography, calculateHomography, roofMetricCorners, type Homography, type Point2 } from './homography.ts'

export interface DroneRoofDimensions { id:'model'|'drone'; label:string; length:number; slope:number }
export const DRONE_DIMENSIONS:DroneRoofDimensions[]=[
  {id:'model',label:'Bisheriges Modell: 10,73 × 6,29 m',length:10.73,slope:6.29},
  {id:'drone',label:'Angabe Drohnenaufnahme: 10,83 × 6,24 m',length:10.83,slope:6.24},
]
export const ROOF_CORNER_LABELS=['Traufe links (0 / 0)','Traufe rechts (X max / 0)','First rechts (X max / Y max)','First links (0 / Y max)'] as const
export const OBJECT_CORNER_LABELS=['unten links','unten rechts','oben rechts','oben links'] as const

export interface MeasuredBounds { xMin:number;xMax:number;yMin:number;yMax:number;centerX:number;centerY:number;width:number;length:number }
export interface DroneObjectResult {
  objectId:string;name:string;points:Point2[];measured:MeasuredBounds;plan:MeasuredBounds
  differencesCm:{xMin:number;xMax:number;yMin:number;yMax:number;centerX:number;centerY:number;width:number;length:number}
  uncertaintyCm:number;planeCaution:boolean
}

export function bounds(points:readonly Point2[]):MeasuredBounds{
  if(!points.length)throw new Error('Keine Messpunkte vorhanden.')
  const xMin=Math.min(...points.map(p=>p.x)),xMax=Math.max(...points.map(p=>p.x)),yMin=Math.min(...points.map(p=>p.y)),yMax=Math.max(...points.map(p=>p.y))
  return {xMin,xMax,yMin,yMax,centerX:(xMin+xMax)/2,centerY:(yMin+yMax)/2,width:xMax-xMin,length:yMax-yMin}
}
export const planBounds=(o:RoofObstruction):MeasuredBounds=>bounds([{x:o.alongMin,y:o.slopeMin},{x:o.alongMax,y:o.slopeMax}])

export function estimatePointUncertainty(source:readonly Point2[],point:Point2,dimensions:DroneRoofDimensions,pixelUncertainty:number):number{
  const target=roofMetricCorners(dimensions.length,dimensions.slope),base=calculateHomography(source,target),mapped=applyHomography(base,point),errors:number[]=[]
  const shifts=[-pixelUncertainty,pixelUncertainty]
  for(let i=0;i<4;i++)for(const axis of ['x','y'] as const)for(const shift of shifts){
    const perturbed=source.map(p=>({...p}));perturbed[i]![axis]+=shift
    try{const p=applyHomography(calculateHomography(perturbed,target),point);errors.push(Math.hypot(p.x-mapped.x,p.y-mapped.y))}catch{/* invalid perturbation is excluded */}
  }
  for(const axis of ['x','y'] as const)for(const shift of shifts){
    const perturbed={...point,[axis]:point[axis]+shift},p=applyHomography(base,perturbed);errors.push(Math.hypot(p.x-mapped.x,p.y-mapped.y))
  }
  return errors.length?Math.sqrt(errors.reduce((sum,e)=>sum+e*e,0)/errors.length):Infinity
}

export function measureDroneObject(h:Homography,roofSource:readonly Point2[],imagePoints:readonly Point2[],dimensions:DroneRoofDimensions,obstruction:RoofObstruction,pixelUncertainty:number):DroneObjectResult{
  if(imagePoints.length!==4)throw new Error(`${obstruction.name}: vier Punkte erforderlich.`)
  const points=imagePoints.map(p=>applyHomography(h,p)),measured=bounds(points),plan=planBounds(obstruction)
  const difference=(key:keyof MeasuredBounds)=>(measured[key]-plan[key])*100
  const uncertaintyCm=Math.max(...imagePoints.map(p=>estimatePointUncertainty(roofSource,p,dimensions,pixelUncertainty)))*100
  return {objectId:obstruction.id,name:obstruction.name,points,measured,plan,differencesCm:{xMin:difference('xMin'),xMax:difference('xMax'),yMin:difference('yMin'),yMax:difference('yMax'),centerX:difference('centerX'),centerY:difference('centerY'),width:difference('width'),length:difference('length')},uncertaintyCm,planeCaution:true}
}
