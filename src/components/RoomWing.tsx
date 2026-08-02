import { RoundedBox, Sparkles, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ROOM_LAYOUTS } from '../game/config';
import type { RoomDefinition, RoomState } from '../game/types';
import { FurryStaff, MaleGuest, RoomActionLabel } from './FurryStaff';

type RoomActivity = RoomDefinition['id'];

function RoomPerson({ position, color, active, activity, speedLevel = 1, guest = false, index = 0, rotation = 0 }: {
  position: [number, number, number];
  color: string;
  active: boolean;
  activity: RoomActivity;
  speedLevel?: number;
  guest?: boolean;
  index?: number;
  rotation?: number;
}) {
  const mover = useRef<THREE.Group>(null);
  const root = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const phase = useMemo(() => index * 1.73 + (guest ? 0.8 : 0), [guest, index]);
  const initialPosition = useRef<[number, number, number]>(position).current;
  const targetPosition = useMemo(() => new THREE.Vector3(...position), [position[0], position[1], position[2]]);

  useFrame(({ clock }, delta) => {
    if (mover.current) {
      mover.current.position.x = THREE.MathUtils.damp(mover.current.position.x, targetPosition.x, 6.5, delta);
      mover.current.position.y = THREE.MathUtils.damp(mover.current.position.y, targetPosition.y, 6.5, delta);
      mover.current.position.z = THREE.MathUtils.damp(mover.current.position.z, targetPosition.z, 6.5, delta);
    }
    const actionSpeed = 2.6 + speedLevel * 0.52;
    const time = clock.elapsedTime * (active ? actionSpeed : 1.55) + phase;
    if (root.current) {
      const poleBounce = activity === 'strip' && active ? Math.abs(Math.sin(time * 1.25)) * 0.11 : 0;
      root.current.position.y = poleBounce + Math.abs(Math.sin(time * 0.7)) * (active ? 0.025 : 0.012);
      root.current.rotation.y = Math.sin(time * 0.42) * (activity === 'sex' ? 0.035 : activity === 'gangbang' ? 0.12 : 0.08);
      const lean = active && activity === 'sex'
        ? -0.24 + Math.sin(time * 1.35) * 0.045
        : active && activity === 'gangbang'
          ? -0.1 + Math.sin(time * 2.8) * 0.055
          : 0;
      root.current.rotation.x = THREE.MathUtils.damp(root.current.rotation.x, lean, 10, delta);
    }
    if (leftArm.current && rightArm.current) {
      let left = Math.sin(time) * 0.08;
      let right = -Math.sin(time) * 0.08;
      if (active && activity === 'strip') {
        left = -1.48 + Math.sin(time * 1.15) * 0.28;
        right = -1.34 - Math.sin(time * 1.15) * 0.28;
      } else if (active && activity === 'sex') {
        left = -0.52 + Math.sin(time * 1.35) * 0.13;
        right = -0.72 - Math.sin(time * 1.35) * 0.13;
      } else if (active && activity === 'gangbang') {
        left = -1.28 + Math.sin(time * 2.7) * 0.3;
        right = -1.28 - Math.sin(time * 2.7) * 0.3;
      }
      leftArm.current.rotation.x = left;
      rightArm.current.rotation.x = right;
    }
  });

  return (
    <group ref={mover} position={initialPosition} scale={guest ? 0.86 : 0.95} rotation={[0, rotation, 0]}>
      <group ref={root}>
        <mesh castShadow position={[0, 1.52, 0]}>
          <sphereGeometry args={[0.25, 14, 10]} />
          <meshStandardMaterial color={guest ? '#e4a276' : '#d99670'} roughness={0.7} />
        </mesh>
        <mesh castShadow position={[0, 1.02, 0]}>
          <capsuleGeometry args={[0.27, 0.55, 6, 12]} />
          <meshStandardMaterial color={color} roughness={0.68} />
        </mesh>
        <group ref={leftArm} position={[-0.34, 1.22, 0]}>
          <mesh position={[0, -0.25, 0]} castShadow><capsuleGeometry args={[0.075, 0.36, 5, 9]} /><meshStandardMaterial color={color} /></mesh>
        </group>
        <group ref={rightArm} position={[0.34, 1.22, 0]}>
          <mesh position={[0, -0.25, 0]} castShadow><capsuleGeometry args={[0.075, 0.36, 5, 9]} /><meshStandardMaterial color={color} /></mesh>
        </group>
        {!guest && activity === 'strip' && (
          <group position={[0.42, 0.86, 0.28]} rotation={[0.12, 0, -0.18]}>
            <mesh><cylinderGeometry args={[0.035, 0.035, 0.38, 8]} /><meshStandardMaterial color="#263442" metalness={0.38} /></mesh>
            <mesh position={[0, 0.23, 0]}><sphereGeometry args={[0.085, 10, 8]} /><meshStandardMaterial color="#111827" metalness={0.3} /></mesh>
          </group>
        )}
        {!guest && activity === 'sex' && (
          <group position={[0.42, 0.88, 0.26]} rotation={[0.15, 0, -0.3]}>
            <mesh><cylinderGeometry args={[0.025, 0.025, 0.48, 8]} /><meshStandardMaterial color="#a66b38" /></mesh>
            <mesh position={[0, -0.27, 0]}><sphereGeometry args={[0.12, 10, 7]} /><meshStandardMaterial color="#c78b4d" roughness={0.8} /></mesh>
          </group>
        )}
        {[-0.14, 0.14].map((x) => (
          <mesh key={x} castShadow position={[x, 0.42, 0]}><capsuleGeometry args={[0.09, 0.45, 5, 9]} /><meshStandardMaterial color="#234352" /></mesh>
        ))}
      </group>
    </group>
  );
}

function RecliningGuestBody({ occupied, color = '#df9c75' }: { occupied: boolean; color?: string }) {
  const root = useRef<THREE.Group>(null);
  const bodyMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const headMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const towelMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const presence = useRef(0);

  useFrame((_, delta) => {
    if (!root.current) return;
    presence.current = THREE.MathUtils.damp(presence.current, occupied ? 1 : 0, occupied ? 6.5 : 22, delta);
    const amount = presence.current;
    // The patron returns to the room's guest spot after a session ends, so
    // fade this platform proxy quickly to avoid showing a duplicate body.
    const opacity = occupied ? amount : amount ** 4;
    root.current.visible = opacity > 0.015;
    root.current.position.z = (1 - amount) * 1.05;
    root.current.position.y = (1 - amount) * 0.18;
    const scale = 0.68 + amount * 0.32;
    root.current.scale.setScalar(scale);
    for (const material of [bodyMaterial.current, headMaterial.current, towelMaterial.current]) {
      if (material) material.opacity = opacity;
    }
  });

  return (
    <group ref={root} visible={false} scale={0.68}>
      <mesh position={[0, 1.02, 0.14]} rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.23, 0.88, 7, 12]} />
        <meshStandardMaterial ref={bodyMaterial} color={color} roughness={0.74} transparent depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.04, -0.72]}>
        <sphereGeometry args={[0.25, 12, 9]} />
        <meshStandardMaterial ref={headMaterial} color="#d99570" roughness={0.7} transparent depthWrite={false} />
      </mesh>
      <RoundedBox args={[0.72, 0.08, 0.82]} radius={0.08} smoothness={2} position={[0, 1.18, 0.37]}>
        <meshStandardMaterial ref={towelMaterial} color="#d85886" roughness={0.9} transparent depthWrite={false} />
      </RoundedBox>
    </group>
  );
}

function StageHearts({ active, color }: { active: boolean; color: string }) {
  const hearts = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!hearts.current) return;
    hearts.current.visible = active;
    hearts.current.children.forEach((child, index) => {
      const progress = (clock.elapsedTime * (0.24 + index * 0.012) + index / 8) % 1;
      child.position.set(-2.5 + (index % 4) * 1.65, 0.65 + progress * 2.25, -1.5 + Math.sin(clock.elapsedTime + index) * 0.24);
      child.rotation.z = Math.sin(clock.elapsedTime * 1.8 + index) * 0.22;
      child.scale.setScalar(0.65 + Math.sin(progress * Math.PI) * 0.55);
    });
  });
  return (
    <group ref={hearts}>
      {Array.from({ length: 8 }, (_, index) => (
        <group key={index}>
          <mesh><sphereGeometry args={[0.09, 9, 7]} /><meshBasicMaterial color={index % 2 ? color : '#71ddff'} transparent opacity={0.8} depthWrite={false} /></mesh>
          <mesh position={[-0.075, 0.06, 0]}><sphereGeometry args={[0.075, 9, 7]} /><meshBasicMaterial color={index % 2 ? color : '#ff7ab7'} transparent opacity={0.8} depthWrite={false} /></mesh>
          <mesh position={[0, -0.1, 0]} rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[0.12, 0.12, 0.035]} /><meshBasicMaterial color={index % 2 ? color : '#ff7ab7'} transparent opacity={0.8} /></mesh>
        </group>
      ))}
    </group>
  );
}

function LockedInterior({ definition }: { definition: RoomDefinition }) {
  const dust = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!dust.current) return;
    dust.current.children.forEach((child, index) => {
      child.position.y = 0.3 + ((clock.elapsedTime * 0.12 + index / 8) % 1) * 2.2;
      child.position.x = Math.sin(clock.elapsedTime * 0.35 + index) * 1.9;
    });
  });
  return (
    <group>
      <RoundedBox args={[5.1, 1.1, 3.25]} radius={0.22} smoothness={3} position={[-0.2, 0.62, -0.15]} castShadow>
        <meshStandardMaterial color="#8b817b" roughness={0.96} />
      </RoundedBox>
      {[-1.35, 0, 1.35].map((x, index) => (
        <mesh key={x} position={[x, 1.35 + index * 0.08, 1.7]} rotation={[0, 0, index % 2 ? 0.08 : -0.06]} castShadow>
          <boxGeometry args={[1.8, 0.16, 0.16]} />
          <meshStandardMaterial color="#9a6337" roughness={0.92} />
        </mesh>
      ))}
      <group position={[0, 1.72, 1.62]}>
        <mesh><boxGeometry args={[0.7, 0.52, 0.12]} /><meshStandardMaterial color="#d8a944" metalness={0.22} /></mesh>
        <mesh position={[0, 0.42, 0]}><torusGeometry args={[0.28, 0.1, 8, 18, Math.PI]} /><meshStandardMaterial color="#d8a944" metalness={0.22} /></mesh>
      </group>
      <group ref={dust}>
        {Array.from({ length: 12 }, (_, index) => <mesh key={index}><sphereGeometry args={[0.035, 6, 5]} /><meshBasicMaterial color={definition.accent} transparent opacity={0.38} /></mesh>)}
      </group>
    </group>
  );
}

function StripInterior({ room, definition }: { room: RoomState; definition: RoomDefinition }) {
  const lights = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!lights.current) return;
    lights.current.children.forEach((child, index) => {
      const material = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.8 + Math.sin(clock.elapsedTime * 5 + index * 1.4) * 0.55;
    });
  });
  const loungeSeats = [-2.4, 0, 2.4].slice(0, room.capacity);
  const qualityLights = [-2.75, -1.38, 0, 1.38, 2.75].slice(0, room.upgrades.quality);
  return (
    <group>
      <RoundedBox args={[6.5, 0.08, 3.12]} radius={0.28} smoothness={4} position={[-0.05, 0.1, 0.6]} receiveShadow>
        <meshStandardMaterial color="#3a183c" roughness={0.62} metalness={0.12} />
      </RoundedBox>
      {[0.75, 1.45, 2.15].map((radius, index) => (
        <mesh key={radius} position={[-0.05, 0.16 + index * 0.002, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius - 0.035, radius, 48]} />
          <meshBasicMaterial color={index % 2 ? definition.accent : '#ff4fa3'} transparent opacity={0.32} depthWrite={false} />
        </mesh>
      ))}
      <RoundedBox args={[6.15, 0.32, 1.82]} radius={0.18} smoothness={3} position={[-0.15, 0.2, -2.18]} castShadow>
        <meshStandardMaterial color="#28112f" roughness={0.58} metalness={0.16} />
      </RoundedBox>
      <group ref={lights} position={[0, 0.16, -2.18]}>
        {[-2.35, -1.2, 0, 1.2, 2.35].map((x, index) => <mesh key={x} position={[x, 0.2, 0]}><cylinderGeometry args={[0.13, 0.18, 0.08, 12]} /><meshStandardMaterial color={index % 2 ? definition.accent : '#ff4fa3'} emissive={index % 2 ? definition.accent : '#ff4fa3'} /></mesh>)}
      </group>
      {[-2.78, 2.78].map((x) => <RoundedBox key={x} args={[0.62, 1.35, 0.58]} radius={0.1} smoothness={2} position={[x, 0.88, -2.62]} castShadow><meshStandardMaterial color="#202338" roughness={0.55} /></RoundedBox>)}
      <group position={[0, 0.92, -1.72]}>
        <mesh castShadow><cylinderGeometry args={[0.05, 0.05, 2.35, 12]} /><meshStandardMaterial color="#d8e7ee" metalness={0.72} roughness={0.18} /></mesh>
        <mesh position={[0, 1.2, 0]}><sphereGeometry args={[0.08, 10, 8]} /><meshStandardMaterial color="#f0f6fa" metalness={0.5} /></mesh>
      </group>
      {/* Медведица — стриптиз на шесте */}
      <FurryStaff
        species="bear"
        pose={room.staffState === 'serving' ? 'strip_pole' : room.staffState === 'welcoming' ? 'strip_floor' : 'idle'}
        active={room.staffState === 'serving' || room.staffState === 'welcoming'}
        speedLevel={room.upgrades.staffSpeed}
        position={[0.05, 0, -1.55]}
        rotation={Math.PI}
        scale={1.05}
      />
      {room.staffState === 'serving' && (
        <>
          <Text position={[0, 2.75, -1.2]} fontSize={0.22} color="#ffb0d8" anchorX="center" outlineWidth={0.012} outlineColor="#2a1020">
            Медведица танцует стриптиз
          </Text>
          <RoomActionLabel text="strip" position={[0, 2.45, -1.2]} />
        </>
      )}
      {/* Гости смотрят шоу */}
      {loungeSeats.map((x, index) => (
        room.staffState === 'serving' && index < room.guests ? (
          <MaleGuest key={`watch-${x}`} position={[x, 0.15, 2.35]} rotation={Math.PI} active={false} pose="standing" paletteIndex={index} />
        ) : null
      ))}
      {loungeSeats.map((x, index) => (
        <group key={x} position={[x, 0, 2.55]}>
          <RoundedBox args={[1.45, 0.46, 0.68]} radius={0.16} smoothness={3} position={[0, 0.28, 0]} castShadow>
            <meshStandardMaterial color={index % 2 ? '#54234e' : '#6d214e'} roughness={0.72} />
          </RoundedBox>
          <RoundedBox args={[1.45, 0.72, 0.24]} radius={0.12} smoothness={3} position={[0, 0.62, 0.28]} castShadow>
            <meshStandardMaterial color={index % 2 ? '#87366f' : '#a63469'} roughness={0.75} />
          </RoundedBox>
          <mesh position={[0, 0.57, -0.02]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.15, 18]} />
            <meshBasicMaterial color={definition.accent} transparent opacity={0.48} />
          </mesh>
        </group>
      ))}
      {qualityLights.map((x, index) => (
        <group key={x} position={[x, 2.34, -3.31]}>
          <mesh><torusGeometry args={[0.2, 0.045, 7, 20]} /><meshStandardMaterial color={index % 2 ? definition.accent : '#ff4fa3'} emissive={index % 2 ? definition.accent : '#ff4fa3'} emissiveIntensity={1.15} /></mesh>
          <pointLight intensity={3.5} distance={3.2} color={index % 2 ? definition.accent : '#ff4fa3'} />
        </group>
      ))}
      {room.upgrades.quality >= 3 && (
        <group position={[2.85, 2.15, 1.75]}>
          <mesh><octahedronGeometry args={[0.38, 1]} /><meshStandardMaterial color="#cdeeff" metalness={0.86} roughness={0.16} /></mesh>
          <pointLight intensity={8} distance={4.5} color={definition.accent} />
        </group>
      )}
      <StageHearts active={room.staffState === 'serving'} color={definition.accent} />
      {ROOM_LAYOUTS.strip.guestSpots.map((spot, index) => (
        <mesh
          key={`${spot.x}-${spot.z}`}
          position={[spot.x - ROOM_LAYOUTS.strip.center.x, 0.045, spot.z - ROOM_LAYOUTS.strip.center.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.34, 0.48, 22]} />
          <meshBasicMaterial color={index % 2 ? '#6de3ff' : definition.accent} transparent opacity={0.38} depthWrite={false} />
        </mesh>
      ))}
      {room.staffState === 'serving' && <Sparkles count={20} scale={[6, 2.3, 4.8]} position={[0, 1.2, 0.2]} size={2.3} speed={0.55} color={definition.accent} />}
    </group>
  );
}

function SexInterior({ room, definition, occupiedSlots }: { room: RoomState; definition: RoomDefinition; occupiedSlots: number[] }) {
  const candleGlow = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!candleGlow.current) return;
    candleGlow.current.children.forEach((child, index) => {
      const progress = (clock.elapsedTime * (0.22 + index * 0.015) + index / 9) % 1;
      child.position.y = 0.55 + progress * 1.55;
      child.position.x = -2.55 + (index % 3) * 2.45 + Math.sin(clock.elapsedTime + index) * 0.14;
      child.position.z = -1.45 + Math.cos(clock.elapsedTime * 0.7 + index) * 0.16;
      child.scale.setScalar(0.35 + progress * 0.7);
      ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.32;
    });
  });
  const localGuestSpots = ROOM_LAYOUTS.sex.guestSpots.map((spot) => ({
    x: spot.x - ROOM_LAYOUTS.sex.center.x,
    z: spot.z - ROOM_LAYOUTS.sex.center.z,
  }));
  const sparkleCount = 7 + room.upgrades.quality * 2;
  return (
    <group>
      <RoundedBox args={[6.65, 0.08, 5.65]} radius={0.2} smoothness={3} position={[0, 0.095, 0]} receiveShadow>
        <meshStandardMaterial color="#4e2038" roughness={0.84} />
      </RoundedBox>
      {[-2.7, -1.8, -0.9, 0, 0.9, 1.8, 2.7].map((x) => (
        <mesh key={x} position={[x, 0.15, 0]}><boxGeometry args={[0.055, 0.025, 5.25]} /><meshStandardMaterial color="#6e3455" roughness={0.88} /></mesh>
      ))}
      <RoundedBox args={[4.9, 0.52, 2.4]} radius={0.24} smoothness={3} position={[-0.2, 0.4, -1.62]} castShadow><meshStandardMaterial color="#6e203f" roughness={0.72} /></RoundedBox>
      <RoundedBox args={[4.62, 0.18, 2.12]} radius={0.18} smoothness={3} position={[-0.2, 0.74, -1.62]} castShadow><meshStandardMaterial color="#f075a9" roughness={0.88} /></RoundedBox>
      <RoundedBox args={[4.62, 0.12, 0.72]} radius={0.15} smoothness={3} position={[-0.2, 0.93, -2.25]} castShadow><meshStandardMaterial color="#ffd1df" roughness={0.92} /></RoundedBox>
      {/* Крольчиха — секс на кровати: cowgirl на члене гостя */}
      {room.staffState === 'serving' && (
        <MaleGuest
          position={[-0.15, 0.82, -1.55]}
          rotation={0}
          active
          pose="receiving"
          paletteIndex={occupiedSlots[0] ?? 0}
          insertDepth={0.85}
        />
      )}
      <FurryStaff
        species="rabbit"
        pose={room.staffState === 'serving' ? 'sex_cowgirl' : 'idle'}
        active={room.staffState === 'serving'}
        speedLevel={room.upgrades.staffSpeed}
        position={[-0.15, room.staffState === 'serving' ? 0.72 : 0.55, -1.48]}
        rotation={Math.PI}
        scale={1.02}
      />
      {room.staffState === 'serving' && (
        <Text position={[0, 2.55, -1.1]} fontSize={0.2} color="#ffc0d8" anchorX="center" outlineWidth={0.01} outlineColor="#2a1020">
          Крольчиха седлает гостя
        </Text>
      )}
      {room.staffState === 'serving' && occupiedSlots.slice(1).map((slot, index) => {
        const spot = localGuestSpots[slot];
        if (!spot) return null;
        return (
          <MaleGuest
            key={`wait-${slot}`}
            position={[spot.x, 0.1, spot.z]}
            rotation={Math.PI}
            pose="waiting"
            active={false}
            paletteIndex={index + 1}
          />
        );
      })}
      {[-2.25, -1.1, 0.05, 1.2, 2.35].map((x) => <mesh key={x} position={[x, 1.15, -2.78]}><boxGeometry args={[0.055, 1.7, 0.08]} /><meshStandardMaterial color="#7b3a61" roughness={0.86} /></mesh>)}
      <RoundedBox args={[0.78, 0.95, 0.78]} radius={0.12} smoothness={2} position={[2.7, 0.54, 1.75]} castShadow>
        <meshStandardMaterial color="#432039" metalness={0.3} roughness={0.58} />
      </RoundedBox>
      {Array.from({ length: 7 }, (_, index) => <mesh key={index} position={[2.47 + (index % 3) * 0.22, 1.08 + Math.floor(index / 3) * 0.12, 1.55 + (index % 2) * 0.18]} castShadow><dodecahedronGeometry args={[0.13, 0]} /><meshStandardMaterial color="#a64d73" roughness={0.95} /></mesh>)}
      <group ref={candleGlow}>{Array.from({ length: sparkleCount }, (_, index) => <mesh key={index}><sphereGeometry args={[0.13, 8, 6]} /><meshBasicMaterial color={index % 2 ? '#ffbdd7' : '#ffd6a8'} transparent depthWrite={false} /></mesh>)}</group>
      {localGuestSpots.slice(0, room.capacity).map((spot, index) => (
        <group key={`${spot.x}-${spot.z}`} position={[spot.x, 0, spot.z]}>
          <RoundedBox args={[0.92, 0.22, 0.62]} radius={0.08} smoothness={2} position={[0, 0.16, 0]} castShadow>
            <meshStandardMaterial color={index % 2 ? '#7a3159' : '#9b3f68'} roughness={0.86} />
          </RoundedBox>
          {!occupiedSlots.includes(index) && <RoundedBox args={[0.56, 0.055, 0.36]} radius={0.05} smoothness={2} position={[0, 0.3, 0]}><meshStandardMaterial color="#ffd0df" roughness={0.94} /></RoundedBox>}
        </group>
      ))}
      <group position={[-2.75, 0, 2.45]}>
        <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.28, 0.34, 0.52, 12]} /><meshStandardMaterial color="#792b50" roughness={0.82} /></mesh>
        <mesh position={[0, 0.63, 0]}><torusGeometry args={[0.24, 0.045, 8, 18, Math.PI]} /><meshStandardMaterial color="#e86699" /></mesh>
      </group>
      {Array.from({ length: room.upgrades.quality }, (_, index) => (
        <RoundedBox key={index} args={[0.56, 0.3, 0.12]} radius={0.05} smoothness={2} position={[3.34, 0.5 + index * 0.36, -2.35 + (index % 2) * 0.68]}>
          <meshStandardMaterial color={index % 2 ? '#ff96bd' : '#ffd0a1'} emissive="#d94d83" emissiveIntensity={0.24 + index * 0.04} roughness={0.74} />
        </RoundedBox>
      ))}
      {Array.from({ length: room.upgrades.staffSpeed }, (_, index) => (
        <group key={index} position={[-2.8 + index * 0.34, 0.28, 1.72]}>
          <mesh><cylinderGeometry args={[0.09, 0.12, 0.36, 10]} /><meshStandardMaterial color={index % 2 ? '#65a690' : '#a7633b'} roughness={0.7} /></mesh>
          <mesh position={[0, 0.21, 0]}><sphereGeometry args={[0.11, 9, 7]} /><meshStandardMaterial color="#eee2c2" /></mesh>
        </group>
      ))}
      {room.staffState === 'serving' && <Sparkles count={14} scale={[5.6, 1.8, 4.7]} position={[0, 1.1, 0]} size={2.1} speed={0.32} color="#fff0cd" />}
    </group>
  );
}

function GangbangInterior({ room, definition, occupiedSlots }: { room: RoomState; definition: RoomDefinition; occupiedSlots: number[] }) {
  const slotPositions = (room.capacity <= 2
    ? ([[-1.15, 0], [1.15, 0]] as [number, number][])
    : ([[-1.35, -0.7], [1.35, -0.7], [-1.35, 0.9], [1.35, 0.9]] as [number, number][])
  ).slice(0, Math.min(room.capacity, 4));
  return (
    <group>
      <RoundedBox args={[6.28, 0.1, 5.5]} radius={0.3} smoothness={4} position={[0, 0.1, -0.1]} receiveShadow>
        <meshStandardMaterial color="#2d0d1d" roughness={0.88} />
      </RoundedBox>
      <RoundedBox args={[4.95, 0.46, 3.75]} radius={0.3} smoothness={4} position={[0, 0.4, -0.25]} castShadow>
        <meshStandardMaterial color="#641933" roughness={0.7} metalness={0.08} />
      </RoundedBox>
      <RoundedBox args={[4.6, 0.08, 3.4]} radius={0.24} smoothness={4} position={[0, 0.68, -0.25]} receiveShadow>
        <meshStandardMaterial color="#9e2d4f" roughness={0.82} />
      </RoundedBox>
      {slotPositions.map(([x, z], index) => {
        const occupied = occupiedSlots.includes(index);
        const serving = room.staffState === 'serving' && occupied;
        // Aim guests inward toward the tigress at the platform center.
        const faceIn = Math.atan2(-x, 0.15 - (z - 0.25));
        return (
          <group key={`${x}-${z}`} position={[x, 0, z - 0.25]}>
            <RoundedBox args={[1.56, 0.16, 1.45]} radius={0.2} smoothness={3} position={[0, 0.78, 0]} castShadow>
              <meshStandardMaterial color={index % 2 ? '#e05278' : '#c43f63'} roughness={0.8} />
            </RoundedBox>
            <RoundedBox args={[0.88, 0.08, 0.42]} radius={0.1} smoothness={2} position={[0, 0.92, -0.38]}>
              <meshStandardMaterial color="#ffd0dc" roughness={0.9} />
            </RoundedBox>
            {occupied && (
              <MaleGuest
                position={[x > 0 ? -0.42 : 0.42, 0.78, 0.28]}
                rotation={faceIn}
                active={serving}
                pose={serving ? 'thrusting' : 'waiting'}
                paletteIndex={index}
                insertDepth={0.9}
              />
            )}
          </group>
        );
      })}
      {slotPositions.length < 4 && [[-1.35, 0.9], [1.35, 0.9]].slice(slotPositions.length).map(([x, z]) => (
        <RoundedBox key={`empty-${x}`} args={[1.2, 0.1, 1.1]} radius={0.16} smoothness={3} position={[x, 0.76, z - 0.25]}>
          <meshStandardMaterial color="#4a1730" roughness={0.9} />
        </RoundedBox>
      ))}
      {/* Тигрица — принимает членов участников */}
      <FurryStaff
        species="tiger"
        pose={room.staffState === 'serving' ? 'gangbang_center' : 'idle'}
        active={room.staffState === 'serving'}
        speedLevel={room.upgrades.staffSpeed}
        position={[0, 0.62, -0.1]}
        rotation={Math.PI}
        scale={1.08}
      />
      {room.staffState === 'serving' && (
        <Text position={[0, 2.7, 0.2]} fontSize={0.2} color="#ff9bb0" anchorX="center" outlineWidth={0.01} outlineColor="#2a1020">
          Тигрица принимает гостей
        </Text>
      )}
      {[-3.1, 3.1].map((x) => <group key={x} position={[x, 0, -2.45]}><mesh position={[0, 0.32, 0]}><cylinderGeometry args={[0.28, 0.34, 0.58, 12]} /><meshStandardMaterial color="#8b2445" /></mesh><mesh position={[0, 0.86, 0]}><sphereGeometry args={[0.42, 10, 8]} /><meshStandardMaterial color="#8c1d42" emissive="#551022" emissiveIntensity={0.22} /></mesh></group>)}
      <RoundedBox args={[2.2, 0.78, 0.62]} radius={0.1} smoothness={3} position={[0, 0.42, -2.8]} castShadow><meshStandardMaterial color="#54162e" roughness={0.85} /></RoundedBox>
      {Array.from({ length: room.upgrades.quality * 2 }, (_, index) => (
        <group key={index} position={[-0.82 + (index % 6) * 0.32, 0.94 + Math.floor(index / 6) * 0.2, -2.78]}>
          <mesh><cylinderGeometry args={[0.055, 0.07, 0.18 + (index % 2) * 0.07, 10]} /><meshStandardMaterial color={index % 2 ? definition.accent : '#f0707b'} roughness={0.55} /></mesh>
          <pointLight intensity={index < room.upgrades.quality ? 1.2 : 0} distance={1.4} color="#ff8798" />
        </group>
      ))}
      {Array.from({ length: room.upgrades.staffSpeed }, (_, index) => (
        <mesh key={index} position={[0.72 + index * 0.2, 0.92, -2.74]}><cylinderGeometry args={[0.055, 0.08, 0.28, 10]} /><meshStandardMaterial color={index % 2 ? '#7bbdaa' : '#e7b57c'} roughness={0.48} /></mesh>
      ))}
      {room.staffState === 'serving' && <Sparkles count={18} scale={[5.6, 1.4, 4.8]} position={[0, 1.4, 0]} size={2.5} speed={0.42} color={definition.accent} />}
    </group>
  );
}

function ServiceProgress({ room, definition }: { room: RoomState; definition: RoomDefinition }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ring.current) return;
    ring.current.scale.setScalar(0.72 + room.progress * 0.55);
    ((ring.current as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = room.staffState === 'serving' ? 0.65 - room.progress * 0.28 : 0;
  });
  return <mesh ref={ring} position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[2.78, 0.055, 6, 40]} /><meshBasicMaterial color={definition.accent} transparent opacity={0.5} depthWrite={false} /></mesh>;
}

function RoomWall({
  args,
  position,
  color,
  focused,
}: {
  args: [number, number, number];
  position: [number, number, number];
  color: string;
  focused: boolean;
}) {
  return (
    <RoundedBox args={args} radius={0.08} smoothness={2} position={position} receiveShadow castShadow={focused}>
      <meshStandardMaterial
        color={color}
        roughness={0.85}
        transparent={!focused}
        opacity={focused ? 1 : 0.72}
        depthWrite={focused}
      />
    </RoundedBox>
  );
}

function PortalArch({ side, accent }: { side: 'east' | 'west' | 'south'; accent: string }) {
  const vertical = side !== 'south';
  const wallX = side === 'east' ? 3.94 : side === 'west' ? -3.94 : 0;
  const wallZ = side === 'south' ? 3.54 : 0;
  const doorOffset = side === 'south' ? 0.6 : 0;
  return (
    <group>
      {[-1.32, 1.32].map((offset) => (
        <RoundedBox
          key={offset}
          args={vertical ? [0.28, 2.42, 0.28] : [0.28, 2.42, 0.28]}
          radius={0.06}
          smoothness={2}
          position={vertical ? [wallX, 1.21, offset] : [doorOffset + offset, 1.21, wallZ]}
          castShadow
        >
          <meshStandardMaterial color="#fff1cb" roughness={0.66} />
        </RoundedBox>
      ))}
      <RoundedBox
        args={vertical ? [0.3, 0.3, 2.92] : [2.92, 0.3, 0.3]}
        radius={0.06}
        smoothness={2}
        position={vertical ? [wallX, 2.4, 0] : [doorOffset, 2.4, wallZ]}
        castShadow
      >
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.18} roughness={0.58} />
      </RoundedBox>
      <RoundedBox
        args={vertical ? [1.3, 0.09, 2.38] : [2.38, 0.09, 1.3]}
        radius={0.08}
        smoothness={2}
        position={vertical ? [side === 'east' ? 4.22 : -4.22, 0.055, 0] : [doorOffset, 0.055, 3.92]}
        receiveShadow
      >
        <meshStandardMaterial color={accent} roughness={0.82} />
      </RoundedBox>
    </group>
  );
}

export function RoomWing({
  room,
  definition,
  focused,
  occupiedSlots,
}: {
  room: RoomState;
  definition: RoomDefinition;
  focused: boolean;
  occupiedSlots: number[];
}) {
  const layout = ROOM_LAYOUTS[definition.id];
  const wallColor = room.unlocked ? definition.color : '#796f6b';
  const floorColor = definition.id === 'strip'
    ? '#42183f'
    : definition.id === 'sex'
      ? '#56213f'
      : '#300d20';
  return (
    <group position={[layout.center.x, 0, layout.center.z]}>
      <RoundedBox args={[layout.size.x, 0.18, layout.size.z]} radius={0.2} smoothness={3} position={[0, 0.02, 0]} receiveShadow>
        <meshStandardMaterial color={room.unlocked ? floorColor : '#c7b9a8'} roughness={0.9} />
      </RoundedBox>
      {definition.id !== 'gangbang' && <RoomWall args={[8.08, 3, 0.22]} position={[0, 1.5, -3.52]} color={wallColor} focused={focused} />}
      {definition.id === 'strip' && (
        <>
          <RoomWall args={[0.22, 3, 2.4]} position={[3.92, 1.5, -2.4]} color={wallColor} focused={focused} />
          <RoomWall args={[0.22, 3, 2.4]} position={[3.92, 1.5, 2.4]} color={wallColor} focused={focused} />
        </>
      )}
      {definition.id === 'sex' && (
        <>
          <RoomWall args={[0.22, 3, 2.4]} position={[-3.92, 1.5, -2.4]} color={wallColor} focused={focused} />
          <RoomWall args={[0.22, 3, 2.4]} position={[-3.92, 1.5, 2.4]} color={wallColor} focused={focused} />
        </>
      )}
      {definition.id === 'gangbang' && (
        <>
          <RoomWall args={[0.22, 3, 7.08]} position={[-3.92, 1.5, 0]} color={wallColor} focused={focused} />
          <RoomWall args={[3.4, 3, 0.22]} position={[-2.3, 1.5, 3.52]} color={wallColor} focused={focused} />
          <RoomWall args={[2.2, 3, 0.22]} position={[2.9, 1.5, 3.52]} color={wallColor} focused={focused} />
        </>
      )}
      <PortalArch side={layout.connectionSide} accent={definition.accent} />
      {room.unlocked ? (
        definition.id === 'strip' ? <StripInterior room={room} definition={definition} />
          : definition.id === 'sex' ? <SexInterior room={room} definition={definition} occupiedSlots={occupiedSlots} />
            : <GangbangInterior room={room} definition={definition} occupiedSlots={occupiedSlots} />
      ) : <LockedInterior definition={definition} />}
      {room.unlocked && <ServiceProgress room={room} definition={definition} />}
      {focused && <Sparkles count={26} scale={[7.2, 2.6, 6.3]} position={[0, 1.25, 0]} size={1.6} speed={0.28} color={definition.accent} />}
      <pointLight position={[1.4, 3.3, 1.3]} intensity={focused ? 25 : 10} distance={9} color={room.unlocked ? definition.accent : '#d5b58d'} />
    </group>
  );
}
