import { describe, expect, it } from 'vitest'
import { focalLength35ToVerticalFov, verticalFovToFocalLength35 } from '../src/model/cameraMath.ts'
import { IPHONE_11_PRO_PHOTO_REFERENCE } from '../src/config/photoReference.ts'

describe('Kameraoptik', () => {
  it('rechnet 35-mm-äquivalente Brennweite und vertikalen FOV verlustarm um', () => {
    const fov = focalLength35ToVerticalFov(26, 4 / 3)
    expect(fov).toBeCloseTo(53.06, 1)
    expect(verticalFovToFocalLength35(fov, 4 / 3)).toBeCloseTo(26, 8)
  })

  it('leitet den vertikalen FOV der dargestellten 4:3-Referenzaufnahme ab', () => {
    const aspect = IPHONE_11_PRO_PHOTO_REFERENCE.rotatedWidthPx / IPHONE_11_PRO_PHOTO_REFERENCE.rotatedHeightPx
    expect(focalLength35ToVerticalFov(26, aspect)).toBeCloseTo(53.060, 3)
  })
})
