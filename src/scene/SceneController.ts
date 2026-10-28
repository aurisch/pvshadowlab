import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { AppConfig, PhotoCameraParameters } from '../model/types.ts'
import { HouseView } from './HouseView.ts'

export class SceneController {
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  private readonly scene = new THREE.Scene()
  private readonly freeCamera = new THREE.PerspectiveCamera(48, 1, 0.05, 1000)
  private readonly photoCamera = new THREE.PerspectiveCamera(50, 4 / 3, 0.05, 1000)
  private readonly controls: OrbitControls
  private readonly house = new HouseView()
  private config: AppConfig
  private resizeObserver: ResizeObserver

  constructor(private readonly host: HTMLElement, config: AppConfig) {
    this.config = config
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    host.append(this.renderer.domElement)
    this.renderer.domElement.setAttribute('aria-label', '3D-Ansicht des Hausmodells')

    this.scene.add(this.house)
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x667080, 2.1))
    const sun = new THREE.DirectionalLight(0xffffff, 2.5)
    sun.position.set(-8, 14, 10)
    this.scene.add(sun)
    const grid = new THREE.GridHelper(40, 40, 0x64707b, 0x9ba5ad)
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
    for (const material of gridMaterials) { material.transparent = true; material.opacity = 0.32 }
    this.scene.add(grid)

    this.freeCamera.position.set(14, 10, 16)
    this.controls = new OrbitControls(this.freeCamera, this.renderer.domElement)
    this.controls.target.set(0, 3, 0)
    this.controls.enableDamping = true
    this.controls.update()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(host)
    this.update(config)
    this.animate()
  }

  update(config: AppConfig): void {
    this.config = config
    this.house.update(config.house, config.roofObstructions, config.showObstructionLabels, config.roofObstructionCalibration, config.useRoofObstructionCalibration)
    this.house.setOpacity(config.modelOpacity)
    this.applyPhotoCamera(config.photoCamera)
    this.controls.enabled = config.cameraMode === 'free'
    this.resize()
  }

  updateCameraOnly(config: AppConfig): void {
    this.config = config
    this.house.setOpacity(config.modelOpacity)
    this.applyPhotoCamera(config.photoCamera)
    this.controls.enabled = config.cameraMode === 'free'
    this.resize()
  }

  resetFreeCamera(): void {
    this.freeCamera.position.set(14, 10, 16)
    this.controls.target.set(0, 3, 0)
    this.controls.update()
  }

  private applyPhotoCamera(c: PhotoCameraParameters): void {
    this.photoCamera.position.set(c.x, c.y, c.z)
    this.photoCamera.fov = c.verticalFovDeg
    this.photoCamera.aspect = c.aspectRatio
    const azimuth = THREE.MathUtils.degToRad(c.azimuthDeg)
    const elevation = THREE.MathUtils.degToRad(c.elevationDeg)
    const direction = new THREE.Vector3(
      Math.sin(azimuth) * Math.cos(elevation),
      Math.sin(elevation),
      Math.cos(azimuth) * Math.cos(elevation),
    )
    this.photoCamera.up.set(0, 1, 0)
    this.photoCamera.lookAt(this.photoCamera.position.clone().add(direction))
    this.photoCamera.rotateZ(THREE.MathUtils.degToRad(c.rollDeg))
    this.photoCamera.updateProjectionMatrix()
  }

  private resize(): void {
    const width = Math.max(1, this.host.clientWidth)
    const height = Math.max(1, this.host.clientHeight)
    this.renderer.setSize(width, height, false)
    this.freeCamera.aspect = width / height
    this.freeCamera.updateProjectionMatrix()
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate)
    this.controls.update()
    this.renderer.render(this.scene, this.config.cameraMode === 'photo' ? this.photoCamera : this.freeCamera)
  }
}
