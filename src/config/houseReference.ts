export const HOUSE_REFERENCE = {
  masonryWidthM: 8.99,
  masonryDepthM: 8.99,
  plasterPerSideM: {
    minimum: 0.03,
    maximum: 0.05,
    confirmed: false,
  },
  roofPitchDeg: {
    minimum: 30,
    maximum: 35,
    confirmed: false,
  },
} as const
