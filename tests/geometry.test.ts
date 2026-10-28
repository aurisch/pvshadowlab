import { describe, expect, it } from 'vitest'
import { calculateHouseGeometry, calculateObstructionCorners, calculateChimney, calculateRidgeRise } from '../src/model/geometry.ts'
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

  it('wendet lokale PV-Korrekturen genau einmal und in definierter Reihenfolge an',()=>{
    const obstruction=EAST_ROOF_OBSTRUCTIONS.find(o=>o.id==='east-04')!,identity=calculateObstructionCorners(DEFAULT_CONFIG.house,obstruction)
    const corrected=calculateObstructionCorners(DEFAULT_CONFIG.house,obstruction,{alongOffset:.2,slopeOffset:-.1,alongScale:1.05,slopeScale:.95})
    const pitch=DEFAULT_CONFIG.house.roofPitchDeg*Math.PI/180
    expect(corrected[0]!.z-identity[0]!.z).toBeCloseTo(.2+obstruction.alongMin*.05,10)
    expect(corrected[0]!.x-identity[0]!.x).toBeCloseTo((-.1+obstruction.slopeMin*-.05)*Math.cos(pitch),10)
    expect(corrected[0]!.y-identity[0]!.y).toBeCloseTo((-.1+obstruction.slopeMin*-.05)*Math.sin(pitch),10)
  })

  it('hält Fenster und Kaminanschluss in der Dachfläche, Oberkante waagerecht',()=>{
    const house=DEFAULT_CONFIG.house,t=Math.tan(house.roofPitchDeg*Math.PI/180)
    for(const obstruction of EAST_ROOF_OBSTRUCTIONS){
      const {base,top}=calculateChimney(house,obstruction,10)
      for(let i=0;i<4;i++){
        expect(base[i]!.y).toBeCloseTo(house.eavesHeight+(base[i]!.x+house.width/2)*t,10)
        expect(top[i]!.y).toBe(10)
        expect(top[i]!.x).toBe(base[i]!.x);expect(top[i]!.z).toBe(base[i]!.z)
      }
      expect(base[0].y).not.toBe(base[3].y)
    }
  })
})
