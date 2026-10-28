import type { AppConfig, ParameterSetting } from './types.ts'
import { IDENTITY_CORRECTION } from './geometry.ts'

export interface ParameterSpec extends ParameterSetting { label:string; group:string; scale:number }

export function parameterSpecs():ParameterSpec[]{
  const camera=(id:string,label:string,min:number,max:number,scale:number,enabled=true):ParameterSpec=>({id:`photoCamera.${id}`,label,group:'Kamera',min,max,scale,enabled})
  const specs=[
    camera('x','Position X (m)',-100,100,5),camera('y','Position Y (m)',-20,60,5),camera('z','Position Z (m)',-100,100,5),
    camera('azimuthDeg','Azimut (°)',-360,360,15),camera('elevationDeg','Elevation (°)',-85,85,10),camera('rollDeg','Rollwinkel (°)',-180,180,5),
    camera('verticalFovDeg','Vertikaler FOV (°)',15,110,10,false),camera('principalX','Bildmittelpunkt X (NDC)',-.4,.4,.1,false),camera('principalY','Bildmittelpunkt Y (NDC)',-.4,.4,.1,false),
    {id:'house.eavesHeight',label:'Traufhöhe (m)',group:'Unsichere Hausgeometrie',min:2,max:12,scale:2,enabled:false},
    {id:'house.roofPitchDeg',label:'Dachneigung (°; Referenz 30°)',group:'Referenzmaße – standardmäßig fest',min:15,max:50,scale:5,enabled:false},
    {id:'house.eaveOverhang',label:'Traufüberstand (m; Referenz 0,90)',group:'Referenzmaße – standardmäßig fest',min:.1,max:2,scale:.3,enabled:false},
    {id:'house.gableOverhang',label:'Giebelüberstand (m; Referenz 0,815)',group:'Referenzmaße – standardmäßig fest',min:0,max:2,scale:.3,enabled:false},
    {id:'calibration.chimneyTopY',label:'Absolute Kaminoberkante Y (m)',group:'Kamin',min:3,max:20,scale:2,enabled:false},
  ]
  for(const [id,name] of [['east-01','Kamin'],['east-03','Fenster Bad'],['east-04','Fenster Südzimmer']]){
    for(const [key,label,min,max,scale] of [['alongOffset','Position entlang First (m)',-2,2,.3],['slopeOffset','Position entlang Dachschräge (m)',-2,2,.3],['alongScale','Breitenfaktor',.5,1.5,.1],['slopeScale','Längenfaktor',.5,1.5,.1]] as const){
      specs.push({id:`correction.${id}.${key}`,label,group:`${name}: Abweichung vom PV-Plan`,min,max,scale,enabled:false})
    }
  }
  return specs
}

export function defaultParameters():ParameterSetting[]{return parameterSpecs().map(({id,enabled,min,max})=>({id,enabled,min,max}))}

export function getParameter(config:AppConfig,id:string):number{
  const [group,key,field]=id.split('.')
  if(group==='correction')return (config.calibration.corrections[key!]??IDENTITY_CORRECTION)[field as keyof typeof IDENTITY_CORRECTION]
  return (config[group as 'house'|'photoCamera'|'calibration'] as unknown as Record<string,number>)[key!]!
}

export function setParameter(config:AppConfig,id:string,value:number):void{
  const [group,key,field]=id.split('.')
  if(group==='correction'){
    config.calibration.corrections[key!]??={...IDENTITY_CORRECTION}
    config.calibration.corrections[key!]![field as keyof typeof IDENTITY_CORRECTION]=value
  }else (config[group as 'house'|'photoCamera'|'calibration'] as unknown as Record<string,number>)[key!]=value
}
