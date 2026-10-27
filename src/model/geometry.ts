import type { HouseParameters } from './types.ts'

export interface Point3 { x: number; y: number; z: number }

export interface HouseGeometryData {
  ridgeHeight: number
  bodyCorners: Point3[]
  roof: {
    left: [Point3, Point3, Point3, Point3]
    right: [Point3, Point3, Point3, Point3]
  }
}

const rad = (degrees: number): number => degrees * Math.PI / 180

export function calculateRidgeRise(width: number, pitchDeg: number): number {
  return (width / 2) * Math.tan(rad(pitchDeg))
}

export function calculateHouseGeometry(p: HouseParameters): HouseGeometryData {
  const halfWidth = p.width / 2
  const halfDepth = p.depth / 2
  const roofHalfWidth = halfWidth + p.eaveOverhang
  const roofHalfDepth = halfDepth + p.gableOverhang
  const ridgeHeight = p.eavesHeight + calculateRidgeRise(p.width, p.roofPitchDeg)
  const roofEaveHeight = p.eavesHeight - p.eaveOverhang * Math.tan(rad(p.roofPitchDeg))
  const bodyCorners: Point3[] = []
  for (const y of [0, p.eavesHeight]) {
    for (const z of [-halfDepth, halfDepth]) {
      for (const x of [-halfWidth, halfWidth]) bodyCorners.push({ x, y, z })
    }
  }
  const ridgeFront = { x: 0, y: ridgeHeight, z: -roofHalfDepth }
  const ridgeBack = { x: 0, y: ridgeHeight, z: roofHalfDepth }
  return {
    ridgeHeight,
    bodyCorners,
    roof: {
      left: [
        { x: -roofHalfWidth, y: roofEaveHeight, z: -roofHalfDepth },
        { x: -roofHalfWidth, y: roofEaveHeight, z: roofHalfDepth },
        ridgeBack,
        ridgeFront,
      ],
      right: [
        ridgeFront,
        ridgeBack,
        { x: roofHalfWidth, y: roofEaveHeight, z: roofHalfDepth },
        { x: roofHalfWidth, y: roofEaveHeight, z: -roofHalfDepth },
      ],
    },
  }
}

export function validateHouseParameters(p: HouseParameters): string[] {
  const errors: string[] = []
  if (p.width <= 0 || p.depth <= 0 || p.eavesHeight <= 0) errors.push('Gebäudemaße müssen größer als 0 sein.')
  if (p.roofPitchDeg <= 0 || p.roofPitchDeg >= 80) errors.push('Die Dachneigung muss zwischen 0° und 80° liegen.')
  if (p.eaveOverhang < 0 || p.gableOverhang < 0) errors.push('Dachüberstände dürfen nicht negativ sein.')
  return errors
}
