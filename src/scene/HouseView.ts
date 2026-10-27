import * as THREE from 'three'
import type { HouseParameters } from '../model/types.ts'
import { calculateHouseGeometry } from '../model/geometry.ts'

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

  update(parameters: HouseParameters): void {
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
    this.rotation.y = THREE.MathUtils.degToRad(parameters.orientationDeg)
  }

  setOpacity(opacity: number): void {
    for (const material of [this.bodyMaterial, this.leftRoofMaterial, this.rightRoofMaterial]) {
      material.opacity = opacity
      material.depthWrite = opacity >= 0.99
    }
    this.traverse((object) => {
      if (object instanceof THREE.LineSegments) {
        const material = object.material as THREE.LineBasicMaterial
        material.opacity = opacity * 0.65
      }
    })
  }

  private addEdges(geometry: THREE.BufferGeometry, color: number): void {
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 }))
    this.addGenerated(edges)
  }

  private addGenerated(object: THREE.Object3D): void {
    this.generated.push(object)
    this.add(object)
  }
}
