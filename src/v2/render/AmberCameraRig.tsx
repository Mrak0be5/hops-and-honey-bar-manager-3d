import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { VenueId } from '../view/model';
import { getCameraFrame } from './layout';

export type AmberCameraRigProps = {
  focus: VenueId;
  drawerOpen: boolean;
  reducedMotion?: boolean;
};

export function AmberCameraRig({ focus, drawerOpen, reducedMotion = false }: AmberCameraRigProps) {
  const { camera, size } = useThree();
  const lookAt = useRef(new THREE.Vector3());
  const desiredLookAt = useMemo(() => new THREE.Vector3(), []);
  const desiredPosition = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    const frame = getCameraFrame(focus, size.width, size.height, drawerOpen);
    desiredLookAt.set(...frame.lookAt);
    desiredPosition.set(...frame.position);

    if (reducedMotion) {
      camera.position.copy(desiredPosition);
      lookAt.current.copy(desiredLookAt);
      camera.zoom = frame.zoom;
      camera.lookAt(lookAt.current);
      camera.updateProjectionMatrix();
      return;
    }

    const positionBlend = 1 - Math.exp(-delta * 4.2);
    const lookBlend = 1 - Math.exp(-delta * 5.4);
    camera.position.lerp(desiredPosition, positionBlend);
    lookAt.current.lerp(desiredLookAt, lookBlend);
    camera.zoom = THREE.MathUtils.damp(camera.zoom, frame.zoom, 5.2, delta);
    camera.lookAt(lookAt.current);
    camera.updateProjectionMatrix();
  }, -2);

  return null;
}
