export const HOUSE_REFERENCE = {
  revision: 2,
  documentedMasonryWidthM: 8.99,
  documentedMasonryDepthM: 8.99,
  buildingWidthM: 9.10,
  buildingDepthM: 9.10,
  roofPitchDeg: 30,
  eaveOverhangM: 0.90,
  roofLengthZM: 10.73,
  roofSlopeLengthM: 6.29,
  gableOverhangM: (10.73 - 9.10) / 2,
} as const
