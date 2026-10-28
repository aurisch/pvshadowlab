export interface Point2 { x:number; y:number }
export interface Homography { matrix:[number,number,number,number,number,number,number,number,number] }

function solve(matrix:number[][],values:number[]):number[]{
  const n=values.length,a=matrix.map((row,i)=>[...row,values[i]!])
  for(let column=0;column<n;column++){
    let pivot=column
    for(let row=column+1;row<n;row++)if(Math.abs(a[row]![column]!)>Math.abs(a[pivot]![column]!))pivot=row
    if(Math.abs(a[pivot]![column]!)<1e-12)throw new Error('Die vier Dachpunkte sind geometrisch ungeeignet oder nahezu kollinear.')
    ;[a[column],a[pivot]]=[a[pivot]!,a[column]!]
    const divisor=a[column]![column]!
    for(let j=column;j<=n;j++)a[column]![j]!/=divisor
    for(let row=0;row<n;row++)if(row!==column){
      const factor=a[row]![column]!
      for(let j=column;j<=n;j++)a[row]![j]!-=factor*a[column]![j]!
    }
  }
  return a.map(row=>row[n]!)
}

/** Exact four-point projective transform. Points must use corresponding order. */
export function calculateHomography(source:readonly Point2[],target:readonly Point2[]):Homography{
  if(source.length!==4||target.length!==4)throw new Error('Genau vier korrespondierende Punkte sind erforderlich.')
  const rows:number[][]=[],values:number[]=[]
  for(let i=0;i<4;i++){
    const {x,y}=source[i]!,u=target[i]!.x,v=target[i]!.y
    rows.push([x,y,1,0,0,0,-u*x,-u*y]);values.push(u)
    rows.push([0,0,0,x,y,1,-v*x,-v*y]);values.push(v)
  }
  const h=solve(rows,values)
  const homography={matrix:[h[0]!,h[1]!,h[2]!,h[3]!,h[4]!,h[5]!,h[6]!,h[7]!,1] as Homography['matrix']}
  const area=(points:readonly Point2[])=>Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length]!;return sum+p.x*q.y-p.y*q.x},0))/2
  if(area(source)<1e-6||area(target)<1e-6)throw new Error('Die vier Dachpunkte spannen keine ausreichend große Fläche auf.')
  for(let i=0;i<4;i++){
    const p=applyHomography(homography,source[i]!)
    if(Math.hypot(p.x-target[i]!.x,p.y-target[i]!.y)>1e-6)throw new Error('Die Homographie ist numerisch instabil. Dachpunkte weiter auseinander setzen.')
  }
  return homography
}

export function applyHomography(h:Homography,p:Point2):Point2{
  const m=h.matrix,w=m[6]*p.x+m[7]*p.y+m[8]
  if(Math.abs(w)<1e-12)throw new Error('Punkt liegt auf der projektiven Unendlichkeitslinie.')
  return {x:(m[0]*p.x+m[1]*p.y+m[2])/w,y:(m[3]*p.x+m[4]*p.y+m[5])/w}
}

export function invertHomography(h:Homography):Homography{
  const m=h.matrix
  const a=m[0],b=m[1],c=m[2],d=m[3],e=m[4],f=m[5],g=m[6],i=m[7],j=m[8]
  const determinant=a*(e*j-f*i)-b*(d*j-f*g)+c*(d*i-e*g)
  if(Math.abs(determinant)<1e-12)throw new Error('Die Homographie ist nicht invertierbar.')
  return {matrix:[
    (e*j-f*i)/determinant,(c*i-b*j)/determinant,(b*f-c*e)/determinant,
    (f*g-d*j)/determinant,(a*j-c*g)/determinant,(c*d-a*f)/determinant,
    (d*i-e*g)/determinant,(b*g-a*i)/determinant,(a*e-b*d)/determinant,
  ]}
}

export function roofMetricCorners(length:number,slope:number):[Point2,Point2,Point2,Point2]{
  if(length<=0||slope<=0)throw new Error('Dachmaße müssen positiv sein.')
  return [{x:0,y:0},{x:length,y:0},{x:length,y:slope},{x:0,y:slope}]
}
