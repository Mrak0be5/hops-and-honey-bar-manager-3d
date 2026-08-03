import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import * as THREE from 'three';
import { AmberVenue } from '../render/AmberVenue';
import { AmberHud } from '../ui/AmberHud';
import '../ui/amber-hud.css';
import type { AmberClubViewProps, AmberQuality } from './model';

const getDpr = (quality: AmberQuality): [number, number] => {
  if (quality === 'mobile') return [1, 1.1];
  if (quality === 'high') return [1, 1.75];
  return [1, 1.4];
};

export function AmberClubView({
  snapshot,
  focus,
  drawerOpen,
  onAction,
  quality = 'auto',
  reducedMotion = false,
  className,
}: AmberClubViewProps) {
  const classes = ['amber-club-shell', className].filter(Boolean).join(' ');

  return (
    <main aria-label="Amber Club — управление развлекательным комплексом" className={classes} data-quality={quality}>
      <Canvas
        camera={{ far: 120, near: 0.1, position: [25, 29, 28], zoom: 25 }}
        dpr={getDpr(quality)}
        frameloop="always"
        gl={{
          alpha: false,
          antialias: quality !== 'mobile',
          powerPreference: 'high-performance',
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.98;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
        orthographic
        shadows={quality !== 'mobile'}
      >
        <Suspense fallback={null}>
          <AmberVenue
            drawerOpen={drawerOpen}
            focus={focus}
            quality={quality}
            reducedMotion={reducedMotion}
            snapshot={snapshot}
          />
        </Suspense>
      </Canvas>
      <AmberHud drawerOpen={drawerOpen} focus={focus} onAction={onAction} snapshot={snapshot} />
    </main>
  );
}
