export const IPHONE_11_PRO_PHOTO_REFERENCE = {
  camera: 'iPhone 11 Pro back camera 4.25mm f/1.8',
  sourceWidthPx: 4032,
  sourceHeightPx: 3024,
  requiredRotationDeg: 90 as const,
  // Der Browser berücksichtigt die EXIF-Orientierung beim Dekodieren. Nach der
  // geforderten zusätzlichen 90°-CCW-Drehung liegt das Arbeitsbild quer vor.
  rotatedWidthPx: 4032,
  rotatedHeightPx: 3024,
  actualFocalLengthMm: 4.25,
  equivalentFocalLength35Mm: 26,
  aperture: 1.8,
  exposureSeconds: 1 / 1754,
  iso: 32,
} as const
