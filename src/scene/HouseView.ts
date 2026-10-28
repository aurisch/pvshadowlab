import * as THREE from 'three'
import type { HouseParameters, RoofObstruction, RoofObstructionCalibration } from '../model/types.ts'
import { calculateHouseGeometry, calculateObstructionCorners } from '../model/geometry.ts'

function quadGeometry(points: readonly { x: number; y: number; z: number }[]): THREE.BufferGeometry {
  const positions = points.flatMap(({ x, y, z }) => [x, y, z])
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  geometry.computeVertexNormals()
  return geometry
}

function triangleGeometry(points: readonly { x: number; y: number; z: number }[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap(({ x, y, z }) => [x, y, z]), 3))
  geometry.setIndex([0, 1, 2])
  geometry.computeVertexNormals()
  return geometry
}

export class HouseView extends THREE.Group {
  private readonly bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xd8c8ad, roughness: 0.85, transparent: true, side: THREE.DoubleSide })
  private readonly leftRoofMaterial = new THREE.MeshStandardMaterial({ color: 0x8d4135, roughness: 0.8, side: THREE.DoubleSide, transparent: true })
  private readonly rightRoofMaterial = new THREE.MeshStandardMaterial({ color: 0xa85243, roughness: 0.8, side: THREE.DoubleSide, transparent: true })
  private body: THREE.Mesh | null = null
  private readonly generated: THREE.Object3D[] = []

  update(parameters: HouseParameters, obstructions: RoofObstruction[] = [], showLabels = false, calibration?:RoofObstructionCalibration, useCalibration = false): void {
    for (const object of this.generated) {
      this.remove(object)
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) object.geometry.dispose()
    }
    this.generated.length = 0
    const data = calculateHouseGeometry(parameters)
    const bodyGeometry = new THREE.BoxGeometry(parameters.width, parameters.eavesHeight, parameters.depth)
    bodyGeometry.translate(0, parameters.eavesHeight / 2, 0)
    this.body = new THREE.Mesh(bodyGeometry, this.bodyMaterial)
    this.addGenerated(this.body)
    this.addEdges(bodyGeometry, 0x504a42)

    for (const z of [-parameters.depth / 2, parameters.depth / 2]) {
      const geometry = triangleGeometry([
        { x: -parameters.width / 2, y: parameters.eavesHeight, z },
        { x: parameters.width / 2, y: parameters.eavesHeight, z },
        { x: 0, y: data.ridgeHeight, z },
      ])
      const gable = new THREE.Mesh(geometry, this.bodyMaterial)
      this.addGenerated(gable)
      this.addEdges(geometry, 0x504a42)
    }

    for (const [points, material] of [[data.roof.left, this.leftRoofMaterial], [data.roof.right, this.rightRoofMaterial]] as const) {
      const geometry = quadGeometry(points)
      const mesh = new THREE.Mesh(geometry, material)
      this.addGenerated(mesh)
      this.addEdges(geometry, 0x542a24)
    }
    for(const obstruction of obstructions){
      const effectiveCalibration=calibration && !useCalibration
        ? {...calibration,alongOffset:0,slopeOffset:0,alongScale:1,slopeScale:1}
        : calibration
      const points=calculateObstructionCorners(parameters,obstruction,effectiveCalibration)
      const color=obstruction.kind==='chimney'?0x565b60:obstruction.kind==='vent'?0xe5b63b:0x4e8eae
      if(obstruction.kind==='chimney'){
        const topY=Math.max(...points.map(point=>point.y))+(calibration?.chimneyHeight??1.5)
        const top=points.map(point=>({x:point.x,y:topY,z:point.z})) as [typeof points[0],typeof points[0],typeof points[0],typeof points[0]]
        const colors=[0x4d555b,0x68737b,0x3f474d,0x77828a]
        for(let index=0;index<4;index++){
          const next=(index+1)%4
          const geometry=quadGeometry([points[index]!,points[next]!,top[next]!,top[index]!])
          const material=new THREE.MeshStandardMaterial({color:colors[index],roughness:.82,side:THREE.DoubleSide,transparent:true,opacity:.95})
          const side=new THREE.Mesh(geometry,material)
          side.userData.opacityFactor=.72
          this.makeOverlay(side,100)
          this.addGenerated(side);this.addEdges(geometry,0x252a2e,101)
        }
        const topGeometry=quadGeometry(top)
        const chimneyTop=new THREE.Mesh(topGeometry,new THREE.MeshStandardMaterial({color:0x89939a,roughness:.85,side:THREE.DoubleSide}))
        chimneyTop.userData.opacityFactor=.72
        this.makeOverlay(chimneyTop,100)
        this.addGenerated(chimneyTop)
        this.addEdges(topGeometry,0x252a2e,101)
        if(showLabels)this.addGenerated(this.createLabel(top,obstruction.name,102))
        continue
      }
      const material=new THREE.MeshStandardMaterial({
        color,roughness:.7,side:THREE.DoubleSide,transparent:true,opacity:.9,
        polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
      })
      const geometry=quadGeometry(points)
      const surface=new THREE.Mesh(geometry,material)
      surface.userData.opacityFactor=.72
      this.makeOverlay(surface,100)
      this.addGenerated(surface)
      this.addEdges(geometry,color,101)
      if(showLabels)this.addGenerated(this.createLabel(points,obstruction.name,102))
    }
    this.rotation.y = THREE.MathUtils.degToRad(parameters.orientationDeg)
  }

  setOpacity(opacity: number): void {
    for (const material of [this.bodyMaterial, this.leftRoofMaterial, this.rightRoofMaterial]) {
      material.opacity = opacity
      material.depthWrite = opacity >= 0.99
    }
    this.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const materials=Array.isArray(object.material)?object.material:[object.material]
        const factor=typeof object.userData.opacityFactor==='number'?object.userData.opacityFactor:1
        for(const material of materials){
          material.transparent=true
          material.opacity=opacity*factor
          material.depthWrite=opacity*factor>=.99
        }
      }
      if (object instanceof THREE.LineSegments) {
        const material = object.material as THREE.LineBasicMaterial
        material.opacity = opacity * 0.65
      }
    })
  }

  private addEdges(geometry: THREE.BufferGeometry, color: number, renderOrder = 0): void {
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 }))
    if (renderOrder > 0) {
      edges.renderOrder = renderOrder
      ;(edges.material as THREE.LineBasicMaterial).depthTest = false
      ;(edges.material as THREE.LineBasicMaterial).depthWrite = false
    }
    this.addGenerated(edges)
  }

  private makeOverlay(mesh: THREE.Mesh, renderOrder: number): void {
    mesh.renderOrder = renderOrder
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      material.depthTest = false
      material.depthWrite = false
    }
  }

  private addGenerated(object: THREE.Object3D): void {
    this.generated.push(object)
    this.add(object)
  }

  private createLabel(points:readonly {x:number;y:number;z:number}[],text:string,renderOrder=0):THREE.Mesh{
    const canvas=document.createElement('canvas'),context=canvas.getContext('2d')!
    canvas.width=512;canvas.height=96
    context.fillStyle='rgba(20,25,29,.82)';context.fillRect(0,0,512,96)
    context.fillStyle='white';context.font='500 34px system-ui';context.textAlign='center';context.textBaseline='middle';context.fillText(text,256,48)
    const texture=new THREE.CanvasTexture(canvas)
    const lifted=points.map((point)=>({x:point.x-.006,y:point.y+.012,z:point.z}))
    const label=new THREE.Mesh(
      quadGeometry(lifted),
      new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide,depthTest:renderOrder===0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),
    )
    label.renderOrder=renderOrder
    return label
  }
}
