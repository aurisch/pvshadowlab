import type { RoofObstruction } from '../model/types.ts'

// Plan coordinates: X runs along the 10.73 m roof length from model Z− to Z+;
// Y runs on the roof surface from the eave toward the ridge. The documented
// Z=100 mm is intentionally ignored; all active surfaces lie in the roof plane.
export const EAST_ROOF_OBSTRUCTIONS: RoofObstruction[] = [
  { id:'east-01',name:'Kamin',roof:'east',alongMin:3.217,alongMax:4.263,slopeMin:3.438,slopeMax:5.077,normalOffset:0,kind:'chimney' },
  { id:'east-03',name:'Fenster Bad',roof:'east',alongMin:4.641,alongMax:5.189,slopeMin:3.878,slopeMax:4.819,normalOffset:0,kind:'window' },
  { id:'east-04',name:'Fenster Südzimmer',roof:'east',alongMin:8.015,alongMax:8.852,slopeMin:3.554,slopeMax:4.630,normalOffset:0,kind:'window' },
]
