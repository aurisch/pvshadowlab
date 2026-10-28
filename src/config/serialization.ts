import type { AppConfig, CalibrationObservation, ObjectCorrection } from '../model/types.ts'
import { calculateObstructionCorners, IDENTITY_CORRECTION, validateHouseParameters } from '../model/geometry.ts'
import { referencePoints } from '../model/calibration.ts'
import { cloneDefaultConfig } from './defaults.ts'
import { defaultParameters } from '../model/parameters.ts'

export function exportConfig(config:AppConfig):string{return JSON.stringify(config,null,2)}
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)
const number=(v:unknown,fallback:number)=>finite(v)?v:fallback
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const array=(v:unknown):unknown[]=>Array.isArray(v)?v:[]

export function importConfig(json:string):AppConfig{
  const value=object(JSON.parse(json))
  if((value.version!==1&&value.version!==2)||!value.house||!value.photoCamera)throw new Error('Nicht unterstützte Konfiguration.')
  const config=cloneDefaultConfig(),house=object(value.house),camera=object(value.photoCamera)
  for(const key of Object.keys(config.house) as (keyof typeof config.house)[]){if(!finite(house[key]))throw new Error('Ungültige Hausparameter.');config.house[key]=house[key]}
  const errors=validateHouseParameters(config.house)
  if(errors.length)throw new Error(errors.join(' '))
  for(const key of Object.keys(config.photoCamera) as (keyof typeof config.photoCamera)[]){
    if((key==='principalX'||key==='principalY')&&camera[key]===undefined)continue
    if(!finite(camera[key]))throw new Error('Ungültige Kameraparameter.')
    config.photoCamera[key]=camera[key]
  }
  if(config.photoCamera.verticalFovDeg<=1||config.photoCamera.verticalFovDeg>=179||config.photoCamera.aspectRatio<=0)throw new Error('Ungültiger Bildwinkel oder Seitenverhältnis.')
  config.houseReferenceRevision=number(value.houseReferenceRevision,0)
  config.cameraMode=value.cameraMode==='photo'?'photo':'free'
  config.overlayMode=value.overlayMode==='photo'||value.overlayMode==='model'?value.overlayMode:'overlay'
  config.modelOpacity=Math.max(0,Math.min(1,number(value.modelOpacity,.72)))
  config.photoRotationDeg=([0,90,180,270].includes(value.photoRotationDeg as number)?value.photoRotationDeg:90) as AppConfig['photoRotationDeg']
  config.showCalibrationMarkers=value.showCalibrationMarkers!==false
  config.showObstructionLabels=value.showObstructionLabels===true
  if(Array.isArray(value.roofObstructions)){
    config.roofObstructions=value.roofObstructions.filter(raw=>object(raw).id!=='east-02').map(raw=>{
      const o=object(raw)
      if(typeof o.id!=='string'||typeof o.name!=='string'||!['window','chimney','vent'].includes(o.kind as string)||o.roof!=='east'||!['alongMin','alongMax','slopeMin','slopeMax','normalOffset'].every(k=>finite(o[k]))||Number(o.alongMin)>=Number(o.alongMax)||Number(o.slopeMin)>=Number(o.slopeMax))throw new Error('Ungültige PV-Plan-Koordinaten.')
      return {...o} as unknown as AppConfig['roofObstructions'][number]
    })
    if(new Set(config.roofObstructions.map(o=>o.id)).size!==config.roofObstructions.length)throw new Error('Doppelte Objekt-ID.')
  }
  const cal=config.calibration
  let rawObservations:unknown[]=[]
  if(value.version===1){
    cal.legacyConfig=json
    cal.migrationNotes.push('Phase-1-Original wurde unverändert gesichert und kann separat exportiert werden.')
    const old=object(value.roofObstructionCalibration)
    const correction:ObjectCorrection={...IDENTITY_CORRECTION}
    for(const key of Object.keys(correction) as (keyof ObjectCorrection)[])correction[key]=number(old[key],correction[key])
    if(correction.alongScale<=0||correction.slopeScale<=0)throw new Error('Ungültige alte Störflächenkalibrierung.')
    if(value.useRoofObstructionCalibration===true){
      for(const o of config.roofObstructions)cal.corrections[o.id]={...correction}
      cal.migrationNotes.push('Aktive alte Rasterkorrektur in explizite lokale Objektkorrekturen überführt. PV-Plan bleibt unverändert.')
    }else if(Object.keys(old).length)cal.migrationNotes.push('Inaktive alte Rasterkorrektur nur im Original-Backup erhalten.')
    const chimney=config.roofObstructions.find(o=>o.kind==='chimney')
    if(chimney)cal.chimneyTopY=Math.max(...calculateObstructionCorners(config.house,chimney,cal.corrections[chimney.id]).map(p=>p.y))+number(old.chimneyHeight,1.5)
    rawObservations=array(value.calibrationObservations).map(raw=>{const o=object(raw);return {...o,pointId:o.landmarkId,active:true,weight:1}})
    for(const [key,id,prefix] of [['observations','east-03',''],['chimneyObservations','east-01','']] as const){
      for(const raw of array(old[key])){
        const o=object(raw),corner=o.corner
        const top=key==='chimneyObservations'&&(corner==='upper-left'||corner==='upper-right')
        rawObservations.push({...o,pointId:`${id}:${top?'top-':prefix}${corner}`,active:true,weight:1})
      }
    }
    cal.migrationNotes.push('Alte Badfenster- und Kaminfrontpunkte wurden über ihre stabilen IDs übernommen. Pixelmaß zunächst 4032 × 3024; tatsächliches lokales Foto hat Vorrang.')
  }else{
    const raw=object(value.calibration)
    if(!value.calibration)throw new Error('Kalibrierungsdaten fehlen.')
    cal.chimneyTopY=number(raw.chimneyTopY,cal.chimneyTopY)
    cal.imageWidth=number(raw.imageWidth,4032);cal.imageHeight=number(raw.imageHeight,3024)
    cal.robustThresholdPx=number(raw.robustThresholdPx,4)
    if(cal.imageWidth<1||cal.imageHeight<1||cal.robustThresholdPx<=0)throw new Error('Ungültiges Bildformat oder robuste Fehlerschwelle.')
    cal.migrationNotes=array(raw.migrationNotes).filter((v):v is string=>typeof v==='string')
    if(typeof raw.legacyConfig==='string')cal.legacyConfig=raw.legacyConfig
    const corrections=object(raw.corrections)
    for(const o of config.roofObstructions){
      if(corrections[o.id]===undefined)continue
      const data=object(corrections[o.id]),correction={...IDENTITY_CORRECTION}
      for(const key of Object.keys(correction) as (keyof ObjectCorrection)[]){if(!finite(data[key]))throw new Error('Ungültige Objektkorrektur.');correction[key]=data[key]}
      if(correction.alongScale<=0||correction.slopeScale<=0)throw new Error('Ungültiger Objektmaßstab.')
      cal.corrections[o.id]=correction
    }
    const settings=array(raw.parameters).map(object)
    cal.parameters=defaultParameters().map(p=>{
      const saved=settings.find(s=>s.id===p.id)
      if(!saved)return p
      if(!finite(saved.min)||!finite(saved.max)||saved.min>=saved.max)throw new Error('Ungültige Parametergrenzen.')
      // Imported bounds may tighten, but never exceed the supported physical bounds.
      const min=Math.max(p.min,saved.min),max=Math.min(p.max,saved.max)
      if(min>=max)throw new Error('Parametergrenzen außerhalb des zulässigen Bereichs.')
      return {id:p.id,enabled:saved.enabled===true,min,max}
    })
    rawObservations=array(raw.observations)
  }
  const known=new Set(referencePoints(config).map(p=>p.id)),seen=new Set<string>()
  for(const raw of rawObservations){
    const o=object(raw)
    if(typeof o.pointId!=='string'||!finite(o.x)||!finite(o.y)||!known.has(o.pointId)||seen.has(o.pointId)){
      cal.migrationNotes.push(`Nicht eindeutig zuordenbarer oder ungültiger Messpunkt (${String(o.pointId)}) nicht aktiviert; Original-JSON prüfen.`)
      cal.legacyConfig??=json
      continue
    }
    seen.add(o.pointId)
    const observation:CalibrationObservation={pointId:o.pointId,x:o.x,y:o.y,active:o.active!==false,weight:number(o.weight,1)}
    if(observation.weight<=0||observation.weight>100)throw new Error('Punktgewicht muss größer als 0 und höchstens 100 sein.')
    cal.observations.push(observation)
  }
  return config
}
