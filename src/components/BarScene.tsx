import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import * as THREE from 'three';
import type { GameEngine } from '../game/GameEngine';
import type { GameEvent, GameSnapshot, Vec2 } from '../game/types';
import { BARTENDER_EMOJI, BartenderCharacter, CUSTOMER_EMOJI, PatronCharacter } from './Character';
import { BarEnvironment } from './Environment';

function SimulationLoop({ engine }: { engine: GameEngine }) {
  useFrame((_, delta) => engine.update(delta), -1);
  return null;
}

function ContextLossGuard({ onContextLost }: { onContextLost: () => void }) {
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      onContextLost();
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);
    return () => canvas.removeEventListener('webglcontextlost', handleContextLost);
  }, [gl, onContextLost]);

  return null;
}

function CanvasPresenter({
  target,
  onUnavailable,
}: {
  target: { current: HTMLCanvasElement | null };
  onUnavailable: () => void;
}) {
  const { gl, scene, camera } = useThree();
  const context = useRef<CanvasRenderingContext2D | null>(null);
  const lastPresentedAt = useRef(-Infinity);
  const failureReported = useRef(false);

  useFrame(({ clock }) => {
    if (clock.elapsedTime - lastPresentedAt.current < 1 / 30) return;
    lastPresentedAt.current = clock.elapsedTime;
    gl.render(scene, camera);
    const source = gl.domElement;
    const destination = target.current;
    if (!destination) return;
    if (destination.width !== source.width || destination.height !== source.height) {
      destination.width = source.width;
      destination.height = source.height;
    }
    const drawingContext = context.current ?? destination.getContext('2d', { alpha: false });
    if (!drawingContext) {
      if (!failureReported.current) {
        failureReported.current = true;
        onUnavailable();
      }
      return;
    }
    context.current = drawingContext;
    drawingContext.imageSmoothingEnabled = true;
    drawingContext.drawImage(source, 0, 0, destination.width, destination.height);
  }, 1);

  return null;
}

function WorldStatusProjector({ target }: { target: RefObject<HTMLDivElement> }) {
  const { camera, size } = useThree();
  const projected = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const container = target.current;
    if (!container) return;
    container.querySelectorAll<HTMLElement>('[data-world-x]').forEach((marker) => {
      projected
        .set(
          Number(marker.dataset.worldX),
          Number(marker.dataset.worldY),
          Number(marker.dataset.worldZ),
        )
        .project(camera);
      const targetLeft = (projected.x * 0.5 + 0.5) * size.width;
      const targetTop = (-projected.y * 0.5 + 0.5) * size.height;
      const currentLeft = Number.parseFloat(marker.style.left);
      const currentTop = Number.parseFloat(marker.style.top);
      const blend = 1 - Math.exp(-delta * 12);
      const nextLeft = Number.isFinite(currentLeft)
        ? THREE.MathUtils.lerp(currentLeft, targetLeft, blend)
        : targetLeft;
      const nextTop = Number.isFinite(currentTop)
        ? THREE.MathUtils.lerp(currentTop, targetTop, blend)
        : targetTop;

      marker.style.left = `${nextLeft}px`;
      marker.style.top = `${nextTop}px`;
      marker.style.visibility = projected.z >= -1 && projected.z <= 1 ? 'visible' : 'hidden';
      marker.style.zIndex = String(Math.round((1 - projected.z) * 100));
    });
  }, 0.5);

  return null;
}

function StatusMarker({
  x,
  y,
  z,
  emoji,
  label,
  bartender = false,
}: {
  x: number;
  y: number;
  z: number;
  emoji: string;
  label: string;
  bartender?: boolean;
}) {
  return (
    <div
      className="world-status-marker"
      data-world-x={x}
      data-world-y={y}
      data-world-z={z}
    >
      <div
        className={`world-emoji ${bartender ? 'is-bartender' : ''}`}
        title={label}
        aria-label={label}
      >
        <span>{emoji}</span>
        <small>{label}</small>
      </div>
    </div>
  );
}

function DecorationMarker({ x, y, z, children }: { x: number; y: number; z: number; children: ReactNode }) {
  return (
    <div
      className="world-decoration-marker"
      data-world-x={x}
      data-world-y={y}
      data-world-z={z}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

function WorldStatusOverlay({ snapshot, target }: { snapshot: GameSnapshot; target: RefObject<HTMLDivElement> }) {
  return (
    <div ref={target} className="world-status-overlay">
      <DecorationMarker x={7.2} y={3.52} z={4.6}>
        <div className="open-sign">OPEN</div>
      </DecorationMarker>
      <DecorationMarker x={-5.7} y={2.15} z={-5.68}>
        <div className="wall-poster">GOOD<br /><b>VIBES</b></div>
      </DecorationMarker>
      <DecorationMarker x={3.6} y={2.65} z={-5.72}>
        <div className="neon-logo"><span>ХМЕЛЬ</span><i>&amp;</i><b>МЁД</b></div>
      </DecorationMarker>
      {snapshot.patrons.map((patron) => {
        const seated = !['walking_in', 'leaving'].includes(patron.state);
        const status = CUSTOMER_EMOJI[patron.state];
        return (
          <StatusMarker
            key={patron.id}
            x={patron.position.x}
            y={seated ? 2.16 : 2.47}
            z={patron.position.z}
            emoji={status.emoji}
            label={status.label}
          />
        );
      })}
      <StatusMarker
        x={snapshot.bartender.position.x}
        y={2.47}
        z={snapshot.bartender.position.z}
        emoji={BARTENDER_EMOJI[snapshot.bartender.state].emoji}
        label={BARTENDER_EMOJI[snapshot.bartender.state].label}
        bartender
      />
    </div>
  );
}

function CameraRig() {
  const { camera, size } = useThree();

  useFrame(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    camera.position.set(11.8, 14.2, 16.2);
    const baseZoom = size.width < 560 ? 33 : size.width < 900 ? 43 : size.width < 1250 ? 51 : 58;
    if (camera.zoom !== baseZoom) {
      camera.zoom = baseZoom;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(-0.25, 0.4, 0.05);
    camera.updateMatrixWorld(true);
  }, -2);
  return null;
}

function PourEffect() {
  const bubbles = useRef<THREE.Group>(null);
  const bubbleData = useMemo(() => Array.from({ length: 8 }, (_, index) => ({
    x: ((index * 37) % 7 - 3) * 0.025,
    z: ((index * 53) % 5 - 2) * 0.025,
    speed: 0.55 + (index % 3) * 0.18,
    offset: index / 8,
  })), []);

  useFrame(({ clock }) => {
    if (!bubbles.current) return;
    const time = clock.elapsedTime;
    bubbles.current.children.forEach((child, index) => {
      const data = bubbleData[index];
      const progress = (time * data.speed + data.offset) % 1;
      child.position.set(data.x, progress * 0.72, data.z);
      const scale = 0.65 + progress * 0.65;
      child.scale.setScalar(scale);
    });
  });

  return (
    <group position={[-1.07, 1.24, -3.43]}>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.035, 0.026, 0.48, 8]} />
        <meshStandardMaterial color="#f4a92f" emissive="#d56f18" emissiveIntensity={0.7} transparent opacity={0.82} />
      </mesh>
      <mesh position={[0, -0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.13, 0.018, 6, 18]} />
        <meshBasicMaterial color="#fff1b0" transparent opacity={0.8} />
      </mesh>
      <group ref={bubbles} position={[0, -0.05, 0]}>
        {bubbleData.map((_, index) => (
          <mesh key={index}>
            <sphereGeometry args={[0.035, 8, 6]} />
            <meshBasicMaterial color="#fff2b7" transparent opacity={0.82} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function EventBurst({ event, position }: { event: GameEvent; position: Vec2 }) {
  const root = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const elapsed = useRef(0);
  const particles = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const angle = (index / 12) * Math.PI * 2;
    const speed = 0.95 + (index % 4) * 0.17;
    return new THREE.Vector3(Math.cos(angle) * speed, 1.25 + (index % 3) * 0.22, Math.sin(angle) * speed);
  }), [event.id]);
  const color = event.kind === 'payment' ? '#ffd24d' : event.kind === 'reputation' ? '#fff09b' : '#71f0cf';

  useFrame((_, delta) => {
    elapsed.current += delta;
    const t = elapsed.current;
    if (!root.current) return;
    root.current.visible = t < 1.35;
    root.current.children.slice(0, particles.length).forEach((child, index) => {
      const velocity = particles[index];
      child.position.set(velocity.x * t, velocity.y * t - 1.5 * t * t, velocity.z * t);
      child.rotation.x += delta * (3 + index * 0.12);
      child.rotation.y += delta * (4 + index * 0.08);
      child.scale.setScalar(Math.max(0.01, 1 - t / 1.35));
      const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 1 - t / 1.15);
    });
    if (ring.current) {
      const scale = 0.5 + t * 2.4;
      ring.current.scale.setScalar(scale);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.72 - t * 0.72);
    }
  });

  return (
    <group ref={root} position={[position.x, 0.65, position.z]}>
      {particles.map((_, index) => (
        <mesh key={index}>
          {index % 3 === 0 ? <octahedronGeometry args={[0.09, 0]} /> : <sphereGeometry args={[0.065, 7, 6]} />}
          <meshBasicMaterial color={color} transparent depthWrite={false} />
        </mesh>
      ))}
      <mesh ref={ring} position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.5, 0.045, 6, 28]} />
        <meshBasicMaterial color={color} transparent opacity={0.72} depthWrite={false} />
      </mesh>
    </group>
  );
}

function World({ snapshot }: { snapshot: GameSnapshot }) {
  return (
    <>
      <color attach="background" args={['#bde8df']} />
      <fog attach="fog" args={['#bde8df', 25, 43]} />
      <hemisphereLight args={['#fff3d5', '#315861', 2.2]} />
      <directionalLight
        castShadow
        position={[7, 14, 8]}
        intensity={2.6}
        color="#fff0cf"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={45}
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={13}
        shadow-camera-bottom={-13}
        shadow-bias={-0.0002}
      />
      <pointLight position={[0, 4.2, -3]} intensity={24} distance={10} color="#ffbd62" />
      <pointLight position={[-5, 3.2, 3]} intensity={13} distance={7} color="#46d4c4" />
      <BarEnvironment tables={snapshot.tables} />
      {snapshot.bartender.state === 'preparing' && <PourEffect />}
      {snapshot.patrons.map((patron) => <PatronCharacter key={patron.id} patron={patron} />)}
      <BartenderCharacter bartender={snapshot.bartender} />
      {snapshot.lastEvent && (
        <EventBurst key={snapshot.lastEvent.id} event={snapshot.lastEvent} position={snapshot.bartender.position} />
      )}
      <CameraRig />
    </>
  );
}

type Props = {
  engine: GameEngine;
  snapshot: GameSnapshot;
  onContextLost: () => void;
};

export function BarScene({ engine, snapshot, onContextLost }: Props) {
  const presentationCanvas = useRef<HTMLCanvasElement>(null);
  const statusOverlay = useRef<HTMLDivElement>(null!);
  const [presentationUnavailable, setPresentationUnavailable] = useState(false);

  return (
    <>
      <Canvas
        key={snapshot.started ? 'running-bar' : 'welcome-bar'}
        className={`game-canvas ${presentationUnavailable ? 'is-direct-visible' : ''}`}
        orthographic
        shadows
        dpr={1}
        camera={{
          position: [11.8, 14.2, 16.2],
          rotation: [-0.7070944888, 0.5159883889, 0.3989877261],
          zoom: 58,
          near: 0.1,
          far: 80,
        }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.12;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <Suspense fallback={null}>
          <ContextLossGuard onContextLost={onContextLost} />
          <SimulationLoop engine={engine} />
          <World snapshot={snapshot} />
          <WorldStatusProjector target={statusOverlay} />
          <CanvasPresenter
            target={presentationCanvas}
            onUnavailable={() => setPresentationUnavailable(true)}
          />
        </Suspense>
      </Canvas>
      <canvas
        ref={presentationCanvas}
        className={`presentation-canvas ${presentationUnavailable ? 'is-disabled' : ''}`}
        aria-hidden="true"
      />
      <WorldStatusOverlay snapshot={snapshot} target={statusOverlay} />
    </>
  );
}
