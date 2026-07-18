import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { GameEngine } from '../game/GameEngine';
import type { GameEvent, GameSnapshot, Vec2 } from '../game/types';
import { BartenderCharacter, PatronCharacter } from './Character';
import { BarEnvironment } from './Environment';

function SimulationLoop({ engine }: { engine: GameEngine }) {
  useFrame((_, delta) => engine.update(delta), -1);
  return null;
}

function CameraRig() {
  const { camera, size } = useThree();

  useEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    camera.position.set(11.8, 14.2, 16.2);
    const baseZoom = size.width < 560 ? 33 : size.width < 900 ? 43 : size.width < 1250 ? 51 : 58;
    camera.zoom = baseZoom;
    camera.lookAt(-0.25, 0.4, 0.05);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }, [camera, size.width]);
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
  return (
    <Canvas
      className="game-canvas"
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
        gl.domElement.addEventListener('webglcontextlost', (event) => {
          event.preventDefault();
          onContextLost();
        }, { once: true });
      }}
    >
      <Suspense fallback={null}>
        <SimulationLoop engine={engine} />
        <World snapshot={snapshot} />
      </Suspense>
    </Canvas>
  );
}
