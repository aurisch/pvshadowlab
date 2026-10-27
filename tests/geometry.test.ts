import { describe, expect, it } from 'vitest'
import { calculateHouseGeometry, calculateRidgeRise } from '../src/model/geometry.ts'
import { DEFAULT_CONFIG } from '../src/config/defaults.ts'

describe('Hausgeometrie', () => {
  it('berechnet die Firsthöhe aus Breite und Dachneigung', () => {
    expect(calculateRidgeRise(9, 30)).toBeCloseTo(2.598076, 6)
    expect(calculateHouseGeometry(DEFAULT_CONFIG.house).ridgeHeight).toBeCloseTo(7.598076, 6)
  })

  it('modelliert Trauf- und Giebelüberstand getrennt', () => {
    const result = calculateHouseGeometry(DEFAULT_CONFIG.house)
    expect(result.roof.left[0].x).toBeCloseTo(-4.85)
    expect(result.roof.left[0].z).toBeCloseTo(-4.85)
    expect(result.roof.left[0].y).toBeCloseTo(5 - 0.35 * Math.tan(Math.PI / 6))
  })

  it('aktualisiert die Eckkoordinaten deterministisch bei Parameteränderungen', () => {
    const changed = calculateHouseGeometry({ ...DEFAULT_CONFIG.house, width: 12, depth: 8, eaveOverhang: 0.5 })
    expect(changed.bodyCorners).toContainEqual({ x: 6, y: 5, z: 4 })
    expect(changed.roof.right[3].x).toBe(6.5)
    expect(changed.ridgeHeight).toBeCloseTo(5 + 6 * Math.tan(Math.PI / 6))
  })
})
