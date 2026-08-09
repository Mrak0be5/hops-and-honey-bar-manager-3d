import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import * as THREE from 'three';
import type { GameEngine } from '../game/GameEngine';
import type { GameEvent, GameSnapshot, VenueView, Vec2 } from '../game/types';
import { ROOM_DEFINITIONS, ROOM_LAYOUTS } from '../game/config';
import { RoomWing } from './RoomWing';
import { BARTENDER_EMOJI, CUSTOMER_EMOJI, PatronCharacter } from './Character';
import { StaffCharacter } from './StaffCharacter';
import { BarEnvironment } from './Environment';
import { BAR_STATION } from '../game/config';

function SimulationLoop({ engine }: { engine: GameEngine }) {
  useFrame((_, delta) => engine.update(delta), -1);
  return null;
}

function ContextLossGuard({ onContextLost }: { onContextLost: () => void }) {
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    let recoveryTimer: number | null = null;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      if (recoveryTimer !== null) window.clearTimeout(recoveryTimer);
      recoveryTimer = window.setTimeout(onContextLost, 900);
    };
    const handleContextRestored = () => {
      if (recoveryTimer !== null) window.clearTimeout(recoveryTimer);
      recoveryTimer = null;
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    return () => {
      if (recoveryTimer !== null) window.clearTimeout(recoveryTimer);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
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
    if (clock.elapsedTime - lastPresentedAt.current < 1 / 40) return;
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

function WorldStatusOverlay({ snapshot, target, focus }: { snapshot: GameSnapshot; target: RefObject<HTMLDivElement>; focus: VenueView }) {
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 680);
  useEffect(() => {
    const update = () => setCompact(window.innerWidth <= 680);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  const candidates = snapshot.patrons.filter((patron) => {
    if (focus === 'bar') return patron.state !== 'waiting_room' && patron.state !== 'in_room';
    if (patron.roomId !== focus) return false;
    // Gangbang guests are already on the platform mesh — hide duplicate DOM markers.
    return !(focus === 'gangbang' && patron.state === 'in_room');
  });
  const visibleLimit = compact ? (focus === 'bar' ? 4 : 3) : Number.POSITIVE_INFINITY;
  const visiblePatrons = candidates.slice(0, visibleLimit);
  const hiddenPatrons = Math.max(0, candidates.length - visiblePatrons.length);
  const overflowPosition = focus === 'bar'
    ? { x: -5.8, z: 4.7 }
    : { x: ROOM_LAYOUTS[focus].center.x, z: ROOM_LAYOUTS[focus].center.z + 2.65 };
  return (
    <div ref={target} className="world-status-overlay">
      {focus === 'bar' && (
        <>
          <DecorationMarker x={7.2} y={3.52} z={4.6}>
            <div className="open-sign">18+</div>
          </DecorationMarker>
          <DecorationMarker x={-5.7} y={2.15} z={-5.68}>
            <div className="wall-poster">HOT<br /><b>NIGHT</b></div>
          </DecorationMarker>
          <DecorationMarker x={1.2} y={2.65} z={-5.72}>
            <div className="neon-logo neon-logo--brothel"><span>БОРДЕЛЬ</span><i>у</i><b>КРИСТОФЕРА</b></div>
          </DecorationMarker>
        </>
      )}
      {visiblePatrons.map((patron) => {
        const moving = patron.state === 'walking_in' || patron.state === 'walking_to_room' || patron.state === 'leaving';
        const seated = !moving && patron.state !== 'waiting_room' && patron.state !== 'in_room';
        const baseStatus = CUSTOMER_EMOJI[patron.state];
        const room = patron.roomId ? ROOM_DEFINITIONS.find((definition) => definition.id === patron.roomId) : null;
        const status = room && patron.state === 'walking_to_room'
          ? { emoji: room.icon, label: `Идёт в ${room.shortName.toLowerCase()}` }
          : room && patron.state === 'waiting_room'
            ? { emoji: '🛎️', label: `Ждёт сеанс: ${room.shortName}` }
            : room && patron.state === 'in_room'
              ? { emoji: room.icon, label: `В комнате: ${room.shortName}` }
              : baseStatus;
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
      {hiddenPatrons > 0 && (
        <StatusMarker
          x={overflowPosition.x}
          y={2.35}
          z={overflowPosition.z}
          emoji={`+${hiddenPatrons}`}
          label={`Ещё гостей: ${hiddenPatrons}`}
        />
      )}
      {focus === 'bar' && snapshot.bartender.staffId && (
        <StatusMarker
          x={snapshot.bartender.position.x}
          y={2.47}
          z={snapshot.bartender.position.z}
          emoji={BARTENDER_EMOJI[snapshot.bartender.state].emoji}
          label={BARTENDER_EMOJI[snapshot.bartender.state].label}
          bartender
        />
      )}
    </div>
  );
}

function CameraRig({ focus, developmentOpen }: { focus: VenueView; developmentOpen: boolean }) {
  const { camera, size } = useThree();
  const currentLook = useRef(new THREE.Vector3(-0.25, 0.4, 0.05));
  const desiredLook = useMemo(() => new THREE.Vector3(), []);
  const desiredPosition = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    const layout = focus === 'bar' ? null : ROOM_LAYOUTS[focus];
    const roomInset = focus === 'strip'
      ? { x: -0.82, z: 0.12 }
      : focus === 'sex'
        ? { x: 0.82, z: 0.12 }
        : focus === 'gangbang'
          ? { x: 0, z: -0.72 }
          : { x: 0, z: 0 };
    const center = layout
      ? { x: layout.center.x + roomInset.x, z: layout.center.z + roomInset.z }
      : { x: -0.25, z: 0.05 };
    const offset = layout?.cameraOffset ?? { x: 12.05, z: 16.15 };
    const portrait = size.height > size.width * 1.2;
    const offsetLength = Math.hypot(offset.x, offset.z) || 1;
    const panelShift = portrait && layout && developmentOpen ? 3.4 : 0;
    const framedCenter = {
      x: center.x + (offset.x / offsetLength) * panelShift,
      z: center.z + (offset.z / offsetLength) * panelShift,
    };
    desiredLook.set(framedCenter.x, 0.08, framedCenter.z);
    desiredPosition.set(framedCenter.x + offset.x, layout ? 15.2 : 14.2, framedCenter.z + offset.z);
    const smoothing = 1 - Math.exp(-delta * 3.8);
    camera.position.lerp(desiredPosition, smoothing);
    currentLook.current.lerp(desiredLook, smoothing);
    const baseZoom = portrait
      ? THREE.MathUtils.clamp(size.width / 11.75, 30.5, 36.5)
      : size.width < 560 ? 33 : size.width < 900 ? 41 : size.width < 1250 ? 47 : 52;
    const targetZoom = focus === 'bar'
      ? baseZoom
      : baseZoom * (portrait ? (developmentOpen ? 0.88 : 0.94) : 1.16);
    const nextZoom = THREE.MathUtils.lerp(camera.zoom, targetZoom, smoothing);
    if (Math.abs(camera.zoom - nextZoom) > 0.001) {
      camera.zoom = nextZoom;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(currentLook.current);
    camera.updateMatrixWorld(true);
  }, -2);
  return null;
}

function PourEffect() {
  const bubbles = useRef<THREE.Group>(null);
  const stream = useRef<THREE.Mesh>(null);
  const bubbleData = useMemo(() => Array.from({ length: 8 }, (_, index) => ({
    x: ((index * 37) % 7 - 3) * 0.025,
    z: ((index * 53) % 5 - 2) * 0.025,
    speed: 0.55 + (index % 3) * 0.18,
    offset: index / 8,
  })), []);

  useFrame(({ clock }) => {
    if (!bubbles.current) return;
    const time = clock.elapsedTime;
    if (stream.current) {
      const pulse = 0.88 + Math.sin(time * 8.5) * 0.12;
      stream.current.scale.set(pulse, 1, pulse);
    }
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
      <mesh ref={stream} position={[0, 0.18, 0]}>
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

function TableActionEffect({ position, kind }: { position: Vec2; kind: 'delivering' | 'cleaning' }) {
  const ring = useRef<THREE.Mesh>(null);
  const particles = useRef<THREE.Group>(null);
  const color = kind === 'cleaning' ? '#76f1d6' : '#ffd86d';

  useFrame(({ clock }) => {
    const progress = (clock.elapsedTime * 1.35) % 1;
    if (ring.current) {
      ring.current.scale.setScalar(0.72 + progress * 0.72);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.62;
    }
    if (particles.current) {
      particles.current.children.forEach((child, index) => {
        const local = (progress + index / particles.current!.children.length) % 1;
        child.position.y = 0.12 + local * 0.62;
        child.position.x = Math.cos(index * 2.2) * (0.24 + local * 0.14);
        child.position.z = Math.sin(index * 2.2) * (0.24 + local * 0.14);
        child.scale.setScalar(Math.sin(local * Math.PI) * 0.9 + 0.08);
      });
    }
  });

  return (
    <group position={[position.x, 0.92, position.z]}>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.72, 0.035, 6, 30]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} depthWrite={false} />
      </mesh>
      <group ref={particles}>
        {[0, 1, 2, 3, 4].map((index) => (
          <mesh key={index}>
            {kind === 'cleaning' ? <sphereGeometry args={[0.065, 8, 6]} /> : <octahedronGeometry args={[0.07, 0]} />}
            <meshBasicMaterial color={color} transparent opacity={0.78} depthWrite={false} />
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
  const particles = useMemo(() => Array.from({ length: 10 }, (_, index) => {
    const angle = (index / 10) * Math.PI * 2;
    const speed = 0.95 + (index % 4) * 0.17;
    return new THREE.Vector3(Math.cos(angle) * speed, 1.25 + (index % 3) * 0.22, Math.sin(angle) * speed);
  }), [event.id]);
  const color = event.kind === 'payment'
    ? '#ffd24d'
    : event.kind === 'room_income'
      ? '#7cf1cf'
      : event.kind === 'room_unlock'
        ? '#ff7fc6'
    : event.kind === 'reputation'
      ? '#fff09b'
      : event.kind === 'upgrade'
        ? '#55e878'
        : event.kind === 'day'
          ? '#ff9b58'
          : '#71f0cf';

  useFrame((_, delta) => {
    elapsed.current += delta;
    const t = elapsed.current;
    if (!root.current) return;
    if (t >= 1.35) {
      root.current.visible = false;
      return;
    }
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
          {event.kind === 'payment' ? (
            <cylinderGeometry args={[0.075, 0.075, 0.035, 10]} />
          ) : event.kind === 'upgrade' ? (
            <coneGeometry args={[0.085, 0.18, 8]} />
          ) : event.kind === 'reputation' || event.kind === 'day' ? (
            <octahedronGeometry args={[0.09, 0]} />
          ) : (
            <sphereGeometry args={[0.065, 7, 6]} />
          )}
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

function World({
  snapshot,
  focus,
  developmentOpen,
  onSelectVenueManage,
}: {
  snapshot: GameSnapshot;
  focus: VenueView;
  developmentOpen: boolean;
  onSelectVenueManage?: (view: VenueView) => void;
}) {
  const serviceKind = snapshot.bartender.state === 'delivering'
    ? 'delivering'
    : snapshot.bartender.state === 'cleaning'
      ? 'cleaning'
      : null;
  const serviceTable = serviceKind && snapshot.bartender.targetTableId !== null
    ? snapshot.tables.find((table) => table.id === snapshot.bartender.targetTableId)
    : null;

  return (
    <>
      <color attach="background" args={['#bde8df']} />
      <fog attach="fog" args={['#bde8df', 38, 78]} />
      <mesh position={[0, -0.16, -3.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[72, 58]} />
        <meshStandardMaterial color="#addfd6" roughness={1} />
      </mesh>
      <hemisphereLight args={['#fff3d5', '#315861', 2.2]} />
      <directionalLight
        castShadow
        position={[7, 14, 8]}
        intensity={2.6}
        color="#fff0cf"
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0002}
      />
      <pointLight position={[0, 4.2, -3]} intensity={24} distance={10} color="#ffbd62" />
      <pointLight position={[-5, 3.2, 3]} intensity={13} distance={7} color="#46d4c4" />
      <BarEnvironment tables={snapshot.tables} />
      {onSelectVenueManage && (
        <mesh
          position={[0.2, 1.2, 0.6]}
          onClick={(event) => {
            event.stopPropagation();
            onSelectVenueManage('bar');
          }}
          onPointerOver={() => {
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'auto';
          }}
        >
          <boxGeometry args={[14.5, 2.4, 9.2]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      {ROOM_DEFINITIONS.map((definition) => (
        <RoomWing
          key={definition.id}
          definition={definition}
          room={snapshot.rooms.find((room) => room.id === definition.id)!}
          focused={focus === definition.id}
          occupiedSlots={snapshot.patrons
            .filter((patron) => patron.roomId === definition.id && patron.state === 'in_room' && patron.roomSlot !== null)
            .map((patron) => patron.roomSlot as number)}
          staffSlots={snapshot.venueSlots[definition.id]}
          onSelectManage={onSelectVenueManage}
        />
      ))}
      {snapshot.bartender.state === 'preparing' && <PourEffect />}
      {snapshot.patrons.map((patron) => (
        patron.state === 'in_room' && patron.roomId === 'gangbang'
          ? null
          : <PatronCharacter key={patron.id} patron={patron} />
      ))}
      {snapshot.bartender.staffId && (
        <StaffCharacter
          characterId={snapshot.bartender.staffId}
          pose="idle"
          active={snapshot.bartender.state !== 'idle'}
          position={[snapshot.bartender.position.x, 0, snapshot.bartender.position.z]}
          rotation={0}
          scale={1.05}
          outfit={
            snapshot.bartender.outfit === 'nude' ? 'nude'
              : snapshot.bartender.outfit === 'uniform' ? 'dressed'
                : 'nude'
          }
        />
      )}
      {snapshot.venueSlots.bar[1] && snapshot.venueSlots.bar[1] !== snapshot.bartender.staffId && (
        <StaffCharacter
          characterId={snapshot.venueSlots.bar[1]}
          pose="idle"
          active={false}
          position={[BAR_STATION.x + 1.1, 0, BAR_STATION.z]}
          rotation={0}
          scale={1}
          outfit="dressed"
        />
      )}
      {snapshot.venueSlots.bar[0] && snapshot.venueSlots.bar[0] !== snapshot.bartender.staffId && snapshot.bartender.staffId === snapshot.venueSlots.bar[1] && (
        <StaffCharacter
          characterId={snapshot.venueSlots.bar[0]}
          pose="idle"
          active={false}
          position={[BAR_STATION.x + 1.1, 0, BAR_STATION.z]}
          rotation={0}
          scale={1}
          outfit="dressed"
        />
      )}
      {serviceKind && serviceTable && <TableActionEffect position={serviceTable.position} kind={serviceKind} />}
      {snapshot.lastEvent && (() => {
        const roomPosition = snapshot.lastEvent.roomId ? ROOM_LAYOUTS[snapshot.lastEvent.roomId].center : null;
        const position = roomPosition ? { ...roomPosition } : snapshot.bartender.position;
        return <EventBurst key={snapshot.lastEvent.id} event={snapshot.lastEvent} position={position} />;
      })()}
      <CameraRig focus={focus} developmentOpen={developmentOpen} />
    </>
  );
}

type Props = {
  engine: GameEngine;
  snapshot: GameSnapshot;
  focus: VenueView;
  developmentOpen: boolean;
  onContextLost: () => void;
  onSelectVenueManage?: (view: VenueView) => void;
};

export function BarScene({ engine, snapshot, focus, developmentOpen, onContextLost, onSelectVenueManage }: Props) {
  const presentationCanvas = useRef<HTMLCanvasElement>(null);
  const statusOverlay = useRef<HTMLDivElement>(null!);
  const [presentationUnavailable, setPresentationUnavailable] = useState(false);

  return (
    <>
      <Canvas
        className={`game-canvas ${presentationUnavailable ? 'is-direct-visible' : ''}`}
        orthographic
        shadows
        frameloop={snapshot.paused ? 'demand' : 'always'}
        dpr={[1, 1.35]}
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
          <World snapshot={snapshot} focus={focus} developmentOpen={developmentOpen} onSelectVenueManage={onSelectVenueManage} />
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
      <WorldStatusOverlay snapshot={snapshot} target={statusOverlay} focus={focus} />
    </>
  );
}
