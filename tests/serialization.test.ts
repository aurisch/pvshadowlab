import { describe, expect, it } from 'vitest'
import { cloneDefaultConfig } from '../src/config/defaults.ts'
import { exportConfig, importConfig } from '../src/config/serialization.ts'

describe('Konfigurations-JSON', () => {
  it('exportiert und importiert die vollständige Konfiguration', () => {
    const config = cloneDefaultConfig()
    config.house.width = 11.25
    config.photoCamera.rollDeg = 2.5
    config.photoRotationDeg = 270
    config.calibrationObservations=[{landmarkId:'ridge-n',x:-0.25,y:0.75}]
    expect(importConfig(exportConfig(config))).toEqual(config)
  })

  it('weist ungültige Konfigurationen zurück', () => {
    expect(() => importConfig('{"version":1}')).toThrow('Nicht unterstützte Konfiguration')
    const config = cloneDefaultConfig()
    config.house.width = -1
    expect(() => importConfig(exportConfig(config))).toThrow('größer als 0')
  })
})
