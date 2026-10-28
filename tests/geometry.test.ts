import { describe, expect, it } from 'vitest'
import { calculateHouseGeometry, calculateObstructionCorners, calculateRidgeRise } from '../src/model/geometry.ts'
import { DEFAULT_CONFIG } from '../src/config/defaults.ts'
import { EAST_ROOF_OBSTRUCTIONS } from '../src/config/roofObstructions.ts'

describe('Hausgeometrie', () => {
  it('berechnet die Firsthöhe aus Breite und Dachneigung', () => {
    expect(calculateRidgeRise(9, 30)).toBeCloseTo(2.598076, 6)
    expect(calculateHouseGeometry(DEFAULT_CONFIG.house).ridgeHeight).toBeCloseTo(5 + 9.1 / 2 * Math.tan(Math.PI / 6), 6)
  })

  it('modelliert Trauf- und Giebelüberstand getrennt', () => {
    const result = calculateHouseGeometry(DEFAULT_CONFIG.house)
    expect(result.roof.left[0].x).toBeCloseTo(-5.45)
    expect(result.roof.left[0].z).toBeCloseTo(-5.365)
    expect(result.roof.left[0].y).toBeCloseTo(5 - 0.9 * Math.tan(Math.PI / 6))
    expect((DEFAULT_CONFIG.house.depth + 2 * DEFAULT_CONFIG.house.gableOverhang)).toBeCloseTo(10.73)
    expect((DEFAULT_CONFIG.house.width / 2 + DEFAULT_CONFIG.house.eaveOverhang) / Math.cos(Math.PI / 6)).toBeCloseTo(6.293, 3)
  })

  it('aktualisiert die Eckkoordinaten deterministisch bei Parameteränderungen', () => {
    const changed = calculateHouseGeometry({ ...DEFAULT_CONFIG.house, width: 12, depth: 8, eaveOverhang: 0.5 })
    expect(changed.bodyCorners).toContainEqual({ x: 6, y: 5, z: 4 })
    expect(changed.roof.right[3].x).toBe(6.5)
    expect(changed.ridgeHeight).toBeCloseTo(5 + 6 * Math.tan(Math.PI / 6))
  })

  it('projiziert die Ost-Störflächen in die geneigte Dachebene',()=>{
    const corners=calculateObstructionCorners(DEFAULT_CONFIG.house,EAST_ROOF_OBSTRUCTIONS[0]!)
    expect(corners[1].z-corners[0].z).toBeCloseTo(1.046)
    const slopeLength=Math.hypot(corners[3].x-corners[0].x,corners[3].y-corners[0].y)
    expect(slopeLength).toBeCloseTo(1.639)
  })
})
