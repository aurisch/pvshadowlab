import * as THREE from 'three'
import type { PhotoCameraParameters } from '../model/types.ts'

/** principalX/Y: displacement of optical center in NDC, positive right/up. */
export function applyPhotoCamera(camera:THREE.PerspectiveCamera,c:PhotoCameraParameters):void{
  camera.position.set(c.x,c.y,c.z)
  camera.fov=c.verticalFovDeg;camera.aspect=c.aspectRatio
  const az=THREE.MathUtils.degToRad(c.azimuthDeg),el=THREE.MathUtils.degToRad(c.elevationDeg)
  camera.up.set(0,1,0)
  camera.lookAt(camera.position.clone().add(new THREE.Vector3(Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el))))
  camera.rotateZ(THREE.MathUtils.degToRad(c.rollDeg))
  camera.clearViewOffset()
  camera.setViewOffset(c.aspectRatio,1,-c.principalX*c.aspectRatio/2,c.principalY/2,c.aspectRatio,1)
  camera.updateProjectionMatrix();camera.updateMatrixWorld()
}
