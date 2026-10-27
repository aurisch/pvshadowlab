export function focalLength35ToVerticalFov(focalLengthMm: number, aspectRatio: number): number {
  const sensorDiagonal = 43.2666153
  const sensorHeight = sensorDiagonal / Math.sqrt(aspectRatio * aspectRatio + 1)
  return 2 * Math.atan(sensorHeight / (2 * focalLengthMm)) * 180 / Math.PI
}

export function verticalFovToFocalLength35(verticalFovDeg: number, aspectRatio: number): number {
  const sensorDiagonal = 43.2666153
  const sensorHeight = sensorDiagonal / Math.sqrt(aspectRatio * aspectRatio + 1)
  return sensorHeight / (2 * Math.tan(verticalFovDeg * Math.PI / 360))
}
