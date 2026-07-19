import { RoundedBox, Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ROOM_LAYOUTS } from '../game/config';
import type { RoomDefinition, RoomState } from '../game/types';

function RoomPerson({ position, color, active, guest = false, index = 0 }: {
  position: [number, number, number]; color: string; active: boolean; guest?: boolean; index?: number;
}) {
  const root = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const phase = useMemo(() => index * 1.73 + (guest ? 0.8 : 0), [guest, index]);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime * (active ? 4.2 : 1.8) + phase;
    if (root.current) {
      root.current.position.y = Math.abs(Math.sin(time)) * (active ? 0.045 : 0.015);
      root.current.rotation.y = Math.sin(time * 0.33) * 0.08;
    }
    if (leftArm.current && rightArm.current) {
      const swing = active ? Math.sin(time) * 0.62 : Math.sin(time) * 0.08;
      leftArm.current.rotation.x = swing;
      rightArm.current.rotation.x = -swing;
    }
  });

  return (
    <group position={position} scale={guest ? 0.86 : 0.95}>
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
        {[-0.14, 0.14].map((x) => (
          <mesh key={x} castShadow position={[x, 0.42, 0]}><capsuleGeometry args={[0.09, 0.45, 5, 9]} /><meshStandardMaterial color="#234352" /></mesh>
        ))}
      </group>
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

function KaraokeInterior({ room, definition }: { room: RoomState; definition: RoomDefinition }) {
  const lights = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!lights.current) return;
    lights.current.children.forEach((child, index) => {
      const material = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.8 + Math.sin(clock.elapsedTime * 5 + index * 1.4) * 0.55;
    });
  });
  return (
    <group>
      <RoundedBox args={[6.15, 0.32, 1.82]} radius={0.18} smoothness={3} position={[-0.15, 0.2, -2.18]} castShadow>
        <meshStandardMaterial color="#3d285c" roughness={0.66} />
      </RoundedBox>
      <group ref={lights} position={[0, 0.16, -2.18]}>
        {[-2.35, -1.2, 0, 1.2, 2.35].map((x, index) => <mesh key={x} position={[x, 0.2, 0]}><cylinderGeometry args={[0.13, 0.18, 0.08, 12]} /><meshStandardMaterial color={index % 2 ? definition.accent : '#68d8ff'} emissive={index % 2 ? definition.accent : '#68d8ff'} /></mesh>)}
      </group>
      {[-2.78, 2.78].map((x) => <RoundedBox key={x} args={[0.62, 1.35, 0.58]} radius={0.1} smoothness={2} position={[x, 0.88, -2.62]} castShadow><meshStandardMaterial color="#202338" roughness={0.55} /></RoundedBox>)}
      <group position={[0, 0.92, -1.72]}>
        <mesh castShadow><cylinderGeometry args={[0.035, 0.035, 1.5, 9]} /><meshStandardMaterial color="#d8e7ee" metalness={0.65} roughness={0.22} /></mesh>
        <mesh position={[0, 0.8, 0.02]} rotation={[0.15, 0, 0]}><capsuleGeometry args={[0.09, 0.16, 6, 10]} /><meshStandardMaterial color="#1b2937" metalness={0.35} /></mesh>
      </group>
      <RoomPerson position={[0.75, 0, -1.55]} color={definition.accent} active={room.staffState === 'serving'} />
      {ROOM_LAYOUTS.karaoke.guestSpots.map((spot, index) => (
        <mesh
          key={`${spot.x}-${spot.z}`}
          position={[spot.x - ROOM_LAYOUTS.karaoke.center.x, 0.045, spot.z - ROOM_LAYOUTS.karaoke.center.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.34, 0.48, 22]} />
          <meshBasicMaterial color={index % 2 ? '#6de3ff' : definition.accent} transparent opacity={0.38} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function SaunaInterior({ room, definition }: { room: RoomState; definition: RoomDefinition }) {
  const steam = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!steam.current) return;
    steam.current.children.forEach((child, index) => {
      const progress = (clock.elapsedTime * (0.22 + index * 0.015) + index / 9) % 1;
      child.position.y = 0.75 + progress * 2.0;
      child.position.x = 2.55 + Math.sin(clock.elapsedTime + index) * 0.22;
      child.position.z = 0.45 + Math.cos(clock.elapsedTime * 0.7 + index) * 0.16;
      child.scale.setScalar(0.5 + progress * 1.25);
      ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.22;
    });
  });
  return (
    <group>
      <RoundedBox args={[5.25, 0.48, 0.78]} radius={0.12} smoothness={2} position={[-0.7, 0.34, -2.15]} castShadow><meshStandardMaterial color="#c8894e" roughness={0.82} /></RoundedBox>
      <RoundedBox args={[5.25, 0.48, 0.78]} radius={0.12} smoothness={2} position={[-0.7, 0.78, -2.72]} castShadow><meshStandardMaterial color="#d99c5e" roughness={0.82} /></RoundedBox>
      {[-2.75, -1.85, -0.95, -0.05, 0.85].map((x) => <mesh key={x} position={[x, 1.1, -3.05]}><boxGeometry args={[0.055, 1.7, 0.08]} /><meshStandardMaterial color="#f0bd78" roughness={0.86} /></mesh>)}
      <RoundedBox args={[1.05, 0.95, 1.05]} radius={0.12} smoothness={2} position={[2.55, 0.54, 0.45]} castShadow>
        <meshStandardMaterial color="#5b5d61" metalness={0.3} roughness={0.58} />
      </RoundedBox>
      {Array.from({ length: 7 }, (_, index) => <mesh key={index} position={[2.28 + (index % 3) * 0.25, 1.08 + Math.floor(index / 3) * 0.12, 0.25 + (index % 2) * 0.25]} castShadow><dodecahedronGeometry args={[0.16, 0]} /><meshStandardMaterial color="#6d5d55" roughness={0.95} /></mesh>)}
      <group ref={steam}>{Array.from({ length: 9 }, (_, index) => <mesh key={index}><sphereGeometry args={[0.17, 8, 6]} /><meshBasicMaterial color="#fff3dc" transparent depthWrite={false} /></mesh>)}</group>
      <RoomPerson position={[2.45, 0, 2.25]} color={definition.color} active={room.staffState === 'serving'} />
    </group>
  );
}

function MassageInterior({ room, definition, occupiedSlots }: { room: RoomState; definition: RoomDefinition; occupiedSlots: number[] }) {
  return (
    <group>
      {[-1.8, 1.8].slice(0, room.capacity).map((x, index) => (
        <group key={x} position={[x, 0, -0.4]}>
          <RoundedBox args={[1.42, 0.42, 2.65]} radius={0.18} smoothness={3} position={[0, 0.58, 0]} castShadow><meshStandardMaterial color="#f3d6b3" roughness={0.84} /></RoundedBox>
          <RoundedBox args={[0.82, 0.22, 0.52]} radius={0.16} smoothness={3} position={[0, 0.88, -0.78]}><meshStandardMaterial color="#c4eee0" /></RoundedBox>
          {occupiedSlots.includes(index) && <mesh position={[0, 1.0, 0.15]} scale={[0.72, 0.35, 1.4]}><capsuleGeometry args={[0.24, 0.72, 7, 12]} /><meshStandardMaterial color="#df9c75" roughness={0.74} /></mesh>}
        </group>
      ))}
      <RoomPerson position={[0, 0, 2.2]} color={definition.color} active={room.staffState === 'serving'} />
      {[-3.1, 3.1].map((x) => <group key={x} position={[x, 0, -2.45]}><mesh position={[0, 0.32, 0]}><cylinderGeometry args={[0.28, 0.34, 0.58, 12]} /><meshStandardMaterial color="#e9b06b" /></mesh><mesh position={[0, 0.86, 0]}><sphereGeometry args={[0.42, 10, 8]} /><meshStandardMaterial color="#63b87f" /></mesh></group>)}
      <RoundedBox args={[2.2, 0.78, 0.62]} radius={0.1} smoothness={3} position={[0, 0.42, -2.8]} castShadow><meshStandardMaterial color="#a87552" roughness={0.85} /></RoundedBox>
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
  return (
    <group position={[layout.center.x, 0, layout.center.z]}>
      <RoundedBox args={[layout.size.x, 0.18, layout.size.z]} radius={0.2} smoothness={3} position={[0, 0.02, 0]} receiveShadow>
        <meshStandardMaterial color={room.unlocked ? '#f5ead0' : '#c7b9a8'} roughness={0.9} />
      </RoundedBox>
      {definition.id !== 'massage' && <RoomWall args={[8.08, 3, 0.22]} position={[0, 1.5, -3.52]} color={wallColor} focused={focused} />}
      {definition.id === 'karaoke' && (
        <>
          <RoomWall args={[0.22, 3, 2.4]} position={[3.92, 1.5, -2.4]} color={wallColor} focused={focused} />
          <RoomWall args={[0.22, 3, 2.4]} position={[3.92, 1.5, 2.4]} color={wallColor} focused={focused} />
        </>
      )}
      {definition.id === 'sauna' && (
        <>
          <RoomWall args={[0.22, 3, 2.4]} position={[-3.92, 1.5, -2.4]} color={wallColor} focused={focused} />
          <RoomWall args={[0.22, 3, 2.4]} position={[-3.92, 1.5, 2.4]} color={wallColor} focused={focused} />
        </>
      )}
      {definition.id === 'massage' && (
        <>
          <RoomWall args={[0.22, 3, 7.08]} position={[-3.92, 1.5, 0]} color={wallColor} focused={focused} />
          <RoomWall args={[3.4, 3, 0.22]} position={[-2.3, 1.5, 3.52]} color={wallColor} focused={focused} />
          <RoomWall args={[2.2, 3, 0.22]} position={[2.9, 1.5, 3.52]} color={wallColor} focused={focused} />
        </>
      )}
      <PortalArch side={layout.connectionSide} accent={definition.accent} />
      {room.unlocked ? (
        definition.id === 'karaoke' ? <KaraokeInterior room={room} definition={definition} />
          : definition.id === 'sauna' ? <SaunaInterior room={room} definition={definition} />
            : <MassageInterior room={room} definition={definition} occupiedSlots={occupiedSlots} />
      ) : <LockedInterior definition={definition} />}
      {room.unlocked && <ServiceProgress room={room} definition={definition} />}
      {focused && <Sparkles count={26} scale={[7.2, 2.6, 6.3]} position={[0, 1.25, 0]} size={1.6} speed={0.28} color={definition.accent} />}
      <pointLight position={[1.4, 3.3, 1.3]} intensity={focused ? 25 : 10} distance={9} color={room.unlocked ? definition.accent : '#d5b58d'} />
    </group>
  );
}
