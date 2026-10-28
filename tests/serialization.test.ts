import { describe, expect, it } from 'vitest'
import { cloneDefaultConfig } from '../src/config/defaults.ts'
import { exportConfig, importConfig } from '../src/config/serialization.ts'

describe('Konfigurations-JSON', () => {
  it('exportiert und importiert die vollständige Konfiguration', () => {
    const config = cloneDefaultConfig()
    config.house.width = 11.25
    config.photoCamera.rollDeg = 2.5
    config.photoRotationDeg = 270
    config.calibration.observations=[{pointId:'ridge-n',x:-0.25,y:0.75,active:false,weight:2}]
    expect(importConfig(exportConfig(config))).toEqual(config)
  })

  it('weist ungültige Konfigurationen zurück', () => {
    expect(() => importConfig('{"version":1}')).toThrow('Nicht unterstützte Konfiguration')
    const config = cloneDefaultConfig()
    config.house.width = -1
    expect(() => importConfig(exportConfig(config))).toThrow('größer als 0')
  })

  it('migriert Phase 1 und bewahrt das exportierbare Original',()=>{
    const current=cloneDefaultConfig()
    const legacy={...current,version:1,calibration:undefined,calibrationObservations:[{landmarkId:'ridge-n',x:.1,y:.2},{landmarkId:'unknown',x:.2,y:.3}],useRoofObstructionCalibration:true,roofObstructionCalibration:{alongOffset:.2,slopeOffset:-.1,alongScale:1.04,slopeScale:.96,chimneyHeight:1.8,observations:[{corner:'upper-left',x:.3,y:.4}],chimneyObservations:[{corner:'upper-left',x:.5,y:.6},{corner:'lower-left',x:.5,y:.1}]}}
    const json=JSON.stringify(legacy),migrated=importConfig(json)
    expect(migrated.version).toBe(2)
    expect(migrated.calibration.legacyConfig).toBe(json)
    expect(migrated.house).toEqual(current.house)
    expect(migrated.calibration.observations.map(o=>o.pointId)).toEqual(['ridge-n','east-03:upper-left','east-01:top-upper-left','east-01:lower-left'])
    expect(migrated.calibration.corrections['east-04']!.alongOffset).toBe(.2)
    expect(migrated.roofObstructions).toEqual(current.roofObstructions)
    expect(migrated.calibration.migrationNotes.join(' ')).toContain('unknown')
    expect(importConfig(exportConfig(migrated))).toEqual(migrated)
  })

  it('weist nicht endliche Hausmaße und ungültige Gewichte zurück',()=>{
    const config=cloneDefaultConfig()
    const raw=JSON.parse(exportConfig(config));raw.house.width=null
    expect(()=>importConfig(JSON.stringify(raw))).toThrow('Hausparameter')
    config.calibration.observations=[{pointId:'ridge-n',x:0,y:0,active:true,weight:-1}]
    expect(()=>importConfig(exportConfig(config))).toThrow('Punktgewicht')
  })
})
