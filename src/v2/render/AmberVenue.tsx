import { RoundedBox } from '@react-three/drei';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { AMBER_CLUB_VENUE, getSlotsByKind } from '../level/venueBlueprint';
import type { AmberQuality, RoomVenueId, VenueId, ViewRoom, ViewSnapshot } from '../view/model';
import { AmberCameraRig } from './AmberCameraRig';
import { AmberCharacter } from './AmberCharacter';
import { AmberEventVfx, KaraokeAtmosphere, MassageAroma, SaunaSteam } from './AmberVfx';
import { AMBER_LAYOUT, ROOM_ORDER } from './layout';
import { AMBER_PALETTE } from './palette';

type Vec3 = [number, number, number];

const BAR_COUNTER = AMBER_CLUB_VENUE.obstacles.find((obstacle) => obstacle.id === 'bar-counter');
const BAR_TABLES = AMBER_CLUB_VENUE.obstacles.filter((obstacle) => obstacle.id.startsWith('bar-table-'));
const BAR_PLANTERS = AMBER_CLUB_VENUE.obstacles.filter((obstacle) => obstacle.id.startsWith('bar-planter-'));
const BAR_GUEST_SLOTS = getSlotsByKind(AMBER_CLUB_VENUE, 'bar_guest');

function Floor({ size, color, position = [0, 0, 0] }: { size: [number, number]; color: string; position?: Vec3 }) {
  return (
    <RoundedBox args={[size[0], 0.26, size[1]]} radius={0.24} smoothness={3} position={[position[0], position[1] - 0.08, position[2]]} receiveShadow>
      <meshStandardMaterial color={color} roughness={0.9} metalness={0.01} />
    </RoundedBox>
  );
}

type WallProps = {
  args: [number, number, number];
  position: Vec3;
  color?: string;
  cutaway?: boolean;
};

function Wall({ args, position, color = AMBER_PALETTE.plaster, cutaway = false }: WallProps) {
  const height = cutaway ? 0.72 : args[1];
  return (
    <RoundedBox
      args={[args[0], height, args[2]]}
      radius={0.08}
      smoothness={2}
      position={[position[0], cutaway ? height / 2 : position[1], position[2]]}
      castShadow={!cutaway}
      receiveShadow
    >
      <meshStandardMaterial color={color} roughness={0.86} metalness={0.01} />
    </RoundedBox>
  );
}

function WallTrim({ args, position, color = AMBER_PALETTE.brass }: { args: [number, number, number]; position: Vec3; color?: string }) {
  return (
    <RoundedBox args={args} radius={0.035} smoothness={2} position={position}>
      <meshStandardMaterial color={color} roughness={0.34} metalness={0.55} />
    </RoundedBox>
  );
}

function InternalDoor({ axis, position, accent, openDirection = 1 }: {
  axis: 'x' | 'z';
  position: Vec3;
  accent: string;
  openDirection?: 1 | -1;
}) {
  const alongX = axis === 'z';
  const postOffset: Vec3 = alongX ? [1.25, 1.28, 0] : [0, 1.28, 1.25];
  const postArgs: [number, number, number] = [0.22, 2.56, 0.22];
  const lintelArgs: [number, number, number] = alongX ? [2.72, 0.25, 0.28] : [0.28, 0.25, 2.72];
  const leafArgs: [number, number, number] = alongX ? [1.08, 2.24, 0.12] : [0.12, 2.24, 1.08];
  const hinge: Vec3 = alongX
    ? [position[0] - 1.08, 1.13, position[2]]
    : [position[0], 1.13, position[2] - 1.08];

  return (
    <group>
      {[-1, 1].map((side) => (
        <RoundedBox
          key={side}
          args={postArgs}
          radius={0.055}
          smoothness={2}
          position={[
            position[0] + postOffset[0] * side,
            postOffset[1],
            position[2] + postOffset[2] * side,
          ]}
          castShadow
        >
          <meshStandardMaterial color={AMBER_PALETTE.cream} roughness={0.76} />
        </RoundedBox>
      ))}
      <RoundedBox args={lintelArgs} radius={0.055} smoothness={2} position={[position[0], 2.48, position[2]]} castShadow>
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.16} roughness={0.5} />
      </RoundedBox>
      <group position={hinge} rotation={[0, openDirection * (alongX ? -1.05 : 1.05), 0]}>
        <RoundedBox args={leafArgs} radius={0.075} smoothness={2} position={alongX ? [0.54, 0, 0] : [0, 0, 0.54]} castShadow>
          <meshStandardMaterial color={AMBER_PALETTE.spruce} roughness={0.65} metalness={0.05} />
        </RoundedBox>
        <RoundedBox args={alongX ? [0.64, 1.28, 0.035] : [0.035, 1.28, 0.64]} radius={0.04} smoothness={2} position={alongX ? [0.54, 0.12, openDirection * 0.075] : [openDirection * 0.075, 0.12, 0.54]}>
          <meshPhysicalMaterial color={accent} roughness={0.18} transmission={0.18} transparent opacity={0.66} />
        </RoundedBox>
      </group>
      <RoundedBox args={alongX ? [2.45, 0.06, 1.35] : [1.35, 0.06, 2.45]} radius={0.07} smoothness={2} position={[position[0], 0.04, position[2]]}>
        <meshStandardMaterial color={accent} roughness={0.7} />
      </RoundedBox>
    </group>
  );
}

function Pendant({ position, shade }: { position: Vec3; shade: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.72, 0]}><cylinderGeometry args={[0.018, 0.018, 1.45, 8]} /><meshStandardMaterial color={AMBER_PALETTE.charcoal} roughness={0.46} metalness={0.52} /></mesh>
      <mesh rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.46, 0.42, 24, 1, true]} /><meshStandardMaterial color={shade} roughness={0.52} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, -0.1, 0]}><sphereGeometry args={[0.12, 12, 9]} /><meshStandardMaterial color={AMBER_PALETTE.honeyLight} emissive={AMBER_PALETTE.honey} emissiveIntensity={1.6} roughness={0.28} /></mesh>
    </group>
  );
}

function Plant({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.25, 0]} castShadow><cylinderGeometry args={[0.3, 0.25, 0.5, 14]} /><meshStandardMaterial color={AMBER_PALETTE.terracotta} roughness={0.8} /></mesh>
      {Array.from({ length: 7 }, (_, index) => {
        const angle = (index / 7) * Math.PI * 2;
        return (
          <mesh key={index} position={[Math.cos(angle) * 0.2, 0.62 + (index % 2) * 0.16, Math.sin(angle) * 0.2]} rotation={[0.18, -angle, 0.65]} castShadow>
            <capsuleGeometry args={[0.105, 0.4, 5, 9]} />
            <meshStandardMaterial color={index % 2 ? AMBER_PALETTE.teal : AMBER_PALETTE.massage} roughness={0.78} />
          </mesh>
        );
      })}
    </group>
  );
}

function DiningChair({ position, rotation = 0, color = AMBER_PALETTE.teal }: { position: Vec3; rotation?: number; color?: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RoundedBox args={[0.72, 0.14, 0.7]} radius={0.1} smoothness={3} position={[0, 0.58, 0]} castShadow><meshStandardMaterial color={color} roughness={0.79} /></RoundedBox>
      <RoundedBox args={[0.7, 0.68, 0.13]} radius={0.08} smoothness={3} position={[0, 0.91, -0.31]} castShadow><meshStandardMaterial color={color} roughness={0.8} /></RoundedBox>
      {[[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]].map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.28, z]} castShadow><cylinderGeometry args={[0.035, 0.045, 0.55, 8]} /><meshStandardMaterial color={AMBER_PALETTE.charcoal} roughness={0.62} metalness={0.3} /></mesh>
      ))}
    </group>
  );
}

function DiningTable({ position, accent = AMBER_PALETTE.terracotta }: { position: Vec3; accent?: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.77, 0]} castShadow receiveShadow><cylinderGeometry args={[1.03, 1.03, 0.18, 28]} /><meshStandardMaterial color={accent} roughness={0.58} /></mesh>
      <mesh position={[0, 0.87, 0]}><torusGeometry args={[0.82, 0.035, 8, 30]} /><meshStandardMaterial color={AMBER_PALETTE.brass} metalness={0.62} roughness={0.28} /></mesh>
      <mesh position={[0, 0.37, 0]} castShadow><cylinderGeometry args={[0.24, 0.35, 0.72, 16]} /><meshStandardMaterial color={AMBER_PALETTE.walnut} roughness={0.7} /></mesh>
      <mesh position={[0, 0.06, 0]} receiveShadow><cylinderGeometry args={[0.62, 0.68, 0.09, 20]} /><meshStandardMaterial color={AMBER_PALETTE.charcoal} roughness={0.88} /></mesh>
      <mesh position={[0, 0.98, 0]}><cylinderGeometry args={[0.055, 0.07, 0.2, 10]} /><meshStandardMaterial color={AMBER_PALETTE.cream} roughness={0.83} /></mesh>
    </group>
  );
}

function BarCounter() {
  const counterX = BAR_COUNTER?.center.x ?? 0;
  const counterZ = BAR_COUNTER?.center.z ?? -4.85;
  const counterWidth = BAR_COUNTER?.kind === 'rect' ? BAR_COUNTER.size.x : 9;
  return (
    <group position={[counterX, 0, counterZ]}>
      <RoundedBox args={[counterWidth - 0.4, 1.25, 1.1]} radius={0.18} smoothness={4} position={[0, 0.65, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={AMBER_PALETTE.terracotta} roughness={0.64} />
      </RoundedBox>
      <RoundedBox args={[counterWidth - 0.05, 0.18, 1.35]} radius={0.12} smoothness={4} position={[0, 1.31, 0]} castShadow>
        <meshStandardMaterial color={AMBER_PALETTE.oak} roughness={0.46} />
      </RoundedBox>
      {[-3.2, -1.6, 0, 1.6, 3.2].map((x, index) => (
        <RoundedBox key={x} args={[1.25, 0.62, 0.035]} radius={0.05} smoothness={2} position={[x, 0.64, 0.57]}>
          <meshStandardMaterial color={index % 2 ? AMBER_PALETTE.spruce : AMBER_PALETTE.teal} roughness={0.76} />
        </RoundedBox>
      ))}
      {[-1.8, -0.6, 0.6, 1.8].map((x, index) => (
        <group key={x} position={[x, 1.55, -0.05]}>
          <mesh position={[0, 0.25, 0]} castShadow><cylinderGeometry args={[0.045, 0.045, 0.5, 10]} /><meshStandardMaterial color={AMBER_PALETTE.brass} metalness={0.7} roughness={0.25} /></mesh>
          <mesh position={[0.14, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.035, 0.035, 0.28, 9]} /><meshStandardMaterial color={AMBER_PALETTE.brass} metalness={0.7} roughness={0.25} /></mesh>
          <mesh position={[0.3, 0.5, 0]}><sphereGeometry args={[0.08, 10, 8]} /><meshStandardMaterial color={index % 2 ? AMBER_PALETTE.karaokeHot : AMBER_PALETTE.honey} roughness={0.4} /></mesh>
        </group>
      ))}
      <group position={[0, 1.8, -1.08]}>
        <RoundedBox args={[7.1, 2.35, 0.35]} radius={0.12} smoothness={3} position={[0, 0, 0]} castShadow>
          <meshStandardMaterial color={AMBER_PALETTE.spruce} roughness={0.72} />
        </RoundedBox>
        {[1.15, 0.1, -0.95].map((y) => <RoundedBox key={y} args={[6.25, 0.12, 0.48]} radius={0.04} smoothness={2} position={[0, y, 0.28]}><meshStandardMaterial color={AMBER_PALETTE.oak} roughness={0.62} /></RoundedBox>)}
        {[-2.5, -1.65, -0.8, 0.05, 0.9, 1.75, 2.6].map((x, index) => (
          <group key={x} position={[x, 0.42 + (index % 2) * 0.1, 0.42]}>
            <mesh castShadow><cylinderGeometry args={[0.1, 0.13, 0.58 + (index % 3) * 0.12, 12]} /><meshStandardMaterial color={[AMBER_PALETTE.honey, AMBER_PALETTE.tealLight, AMBER_PALETTE.terracotta, AMBER_PALETTE.karaokeHot][index % 4]} roughness={0.3} metalness={0.04} /></mesh>
            <mesh position={[0, 0.38, 0]}><cylinderGeometry args={[0.045, 0.055, 0.18, 10]} /><meshStandardMaterial color={AMBER_PALETTE.brass} metalness={0.5} roughness={0.25} /></mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function MainBarInterior() {
  const tablePositions = BAR_TABLES.map((obstacle): Vec3 => [obstacle.center.x, 0, obstacle.center.z]);
  return (
    <group>
      <RoundedBox args={[2.7, 0.055, 10.7]} radius={0.22} smoothness={3} position={[0, 0.11, 0.8]} receiveShadow><meshStandardMaterial color="#d6c19c" roughness={0.95} /></RoundedBox>
      <BarCounter />
      {tablePositions.map((position, index) => (
        <group key={`${position[0]}-${position[2]}`}>
          <DiningTable position={position} accent={index % 2 ? '#af6748' : AMBER_PALETTE.terracotta} />
          <DiningChair position={[position[0], 0, position[2] + 1.25]} rotation={Math.PI} color={index % 2 ? AMBER_PALETTE.teal : '#356c69'} />
          <DiningChair position={[position[0] + (position[0] < 0 ? -1.25 : 1.25), 0, position[2]]} rotation={position[0] < 0 ? Math.PI / 2 : -Math.PI / 2} color={index % 2 ? '#356c69' : AMBER_PALETTE.teal} />
        </group>
      ))}
      {BAR_PLANTERS.map((obstacle, index) => (
        <Plant key={obstacle.id} position={[obstacle.center.x, 0.04, obstacle.center.z]} scale={index === 0 ? 1.05 : 0.92} />
      ))}
      {BAR_GUEST_SLOTS.map((slot) => (
        <group key={`stool-${slot.id}`} position={[slot.position.x, 0, slot.position.z]}>
          <mesh position={[0, 0.47, 0]} castShadow><cylinderGeometry args={[0.38, 0.34, 0.12, 18]} /><meshStandardMaterial color={AMBER_PALETTE.teal} roughness={0.72} /></mesh>
          <mesh position={[0, 0.23, 0]} castShadow><cylinderGeometry args={[0.08, 0.13, 0.46, 10]} /><meshStandardMaterial color={AMBER_PALETTE.brass} metalness={0.54} roughness={0.32} /></mesh>
        </group>
      ))}
      <Pendant position={[-4.4, 3.45, 0.7]} shade={AMBER_PALETTE.terracotta} />
      <Pendant position={[4.4, 3.45, 0.7]} shade={AMBER_PALETTE.teal} />
      <Pendant position={[0, 3.65, 3.4]} shade={AMBER_PALETTE.honey} />
      <group position={[0, 1.35, 6.76]}>
        <RoundedBox args={[3.2, 2.5, 0.2]} radius={0.12} smoothness={3} castShadow><meshStandardMaterial color={AMBER_PALETTE.spruce} roughness={0.72} /></RoundedBox>
        <RoundedBox args={[2.55, 1.75, 0.05]} radius={0.08} smoothness={2} position={[0, 0.12, -0.13]}><meshPhysicalMaterial color={AMBER_PALETTE.tealLight} roughness={0.2} transmission={0.18} transparent opacity={0.68} /></RoundedBox>
        <mesh position={[1.08, 0, -0.2]}><sphereGeometry args={[0.085, 10, 8]} /><meshStandardMaterial color={AMBER_PALETTE.brass} metalness={0.7} roughness={0.24} /></mesh>
      </group>
    </group>
  );
}

const getUpgradeLevel = (room: ViewRoom | undefined, id: string) => (
  room?.upgrades.find((upgrade) => upgrade.id === id)?.level ?? 1
);

function KaraokeInterior({ active, quality, room }: { active: boolean; quality: number; room: ViewRoom | undefined }) {
  const staffLevel = getUpgradeLevel(room, 'staffSpeed');
  const capacityLevel = getUpgradeLevel(room, 'capacity');
  const serviceLevel = getUpgradeLevel(room, 'quality');
  return (
    <group>
      <RoundedBox args={[9.8, 0.08, 6.8]} radius={0.24} smoothness={4} position={[-0.35, 0.11, -0.35]} receiveShadow><meshStandardMaterial color="#4a3767" roughness={0.72} /></RoundedBox>
      <RoundedBox args={[8.8, 0.28, 2.15]} radius={0.16} smoothness={3} position={[-0.4, 0.25, -3.68]} castShadow><meshStandardMaterial color="#352542" roughness={0.66} /></RoundedBox>
      <RoundedBox args={[4.2, 1.8, 0.18]} radius={0.12} smoothness={3} position={[-0.4, 1.85, -4.68]}><meshStandardMaterial color={AMBER_PALETTE.charcoal} roughness={0.42} metalness={0.14} /></RoundedBox>
      <RoundedBox args={[3.68, 1.35, 0.035]} radius={0.08} smoothness={2} position={[-0.4, 1.85, -4.57]}><meshStandardMaterial color={AMBER_PALETTE.karaoke} emissive={AMBER_PALETTE.karaokeHot} emissiveIntensity={0.6} roughness={0.32} /></RoundedBox>
      {[-4.25, 3.45].map((x) => (
        <group key={x} position={[x, 0.8, -3.82]}>
          <RoundedBox args={[0.72, 1.55, 0.72]} radius={0.1} smoothness={3} castShadow><meshStandardMaterial color={AMBER_PALETTE.charcoal} roughness={0.52} /></RoundedBox>
          {[0.38, 0.86].map((y) => <mesh key={y} position={[0, y - 0.78, 0.38]}><circleGeometry args={[0.2, 20]} /><meshStandardMaterial color={AMBER_PALETTE.karaokeBlue} emissive={AMBER_PALETTE.karaokeBlue} emissiveIntensity={0.3} /></mesh>)}
        </group>
      ))}
      {(staffLevel >= 2 ? [-1.55, 0.75] : [-0.4]).map((x) => (
        <group key={x} position={[x, 0.1, -2.72]}>
          <mesh position={[0, 0.82, 0]}><cylinderGeometry args={[0.035, 0.035, 1.45, 9]} /><meshStandardMaterial color={AMBER_PALETTE.brass} metalness={0.65} roughness={0.24} /></mesh>
          <mesh position={[0, 1.58, 0]} rotation={[0.2, 0, 0]}><capsuleGeometry args={[0.08, 0.16, 6, 10]} /><meshStandardMaterial color={AMBER_PALETTE.charcoal} metalness={0.28} roughness={0.34} /></mesh>
        </group>
      ))}
      <group position={[-1.1, 0, 3.55]}>
        <RoundedBox args={[6.7, 0.58, 1.3]} radius={0.24} smoothness={4} position={[0, 0.32, 0]} castShadow><meshStandardMaterial color="#705087" roughness={0.82} /></RoundedBox>
        <RoundedBox args={[6.7, 0.8, 0.34]} radius={0.16} smoothness={3} position={[0, 0.72, 0.48]} castShadow><meshStandardMaterial color="#846499" roughness={0.84} /></RoundedBox>
        {[-2.25, 0, 2.25].map((x) => <RoundedBox key={x} args={[1.15, 0.2, 0.8]} radius={0.12} smoothness={3} position={[x, 0.78, -0.08]}><meshStandardMaterial color={x === 0 ? AMBER_PALETTE.karaokeHot : AMBER_PALETTE.karaokeBlue} roughness={0.78} /></RoundedBox>)}
      </group>
      {capacityLevel >= 3 && [-4.15, 2.05].map((x) => (
        <RoundedBox key={`karaoke-pouf-${x}`} args={[1.25, 0.46, 1.05]} radius={0.26} smoothness={4} position={[x, 0.26, 1.45]} castShadow>
          <meshStandardMaterial color={x < 0 ? AMBER_PALETTE.karaokeBlue : AMBER_PALETTE.karaokeHot} roughness={0.8} />
        </RoundedBox>
      ))}
      {serviceLevel >= 2 && (
        <group position={[-0.4, 3.05, -2.55]}>
          <RoundedBox args={[7.8, 0.12, 0.12]} radius={0.035} smoothness={2}><meshStandardMaterial color={AMBER_PALETTE.brass} metalness={0.68} roughness={0.26} /></RoundedBox>
          {[-3, -1, 1, 3].map((x, index) => (
            <mesh key={`karaoke-spot-${x}`} position={[x, -0.18, 0]} rotation={[0.4, 0, 0]}>
              <coneGeometry args={[0.19, 0.32, 14]} />
              <meshStandardMaterial color={index % 2 ? AMBER_PALETTE.karaokeBlue : AMBER_PALETTE.karaokeHot} emissive={index % 2 ? AMBER_PALETTE.karaokeBlue : AMBER_PALETTE.karaokeHot} emissiveIntensity={0.65} />
            </mesh>
          ))}
        </group>
      )}
      {serviceLevel >= 4 && (
        <mesh position={[-0.4, 0.42, -2.7]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.55, 0.07, 10, 48]} />
          <meshStandardMaterial color={AMBER_PALETTE.honey} emissive={AMBER_PALETTE.honey} emissiveIntensity={0.85} metalness={0.38} roughness={0.28} />
        </mesh>
      )}
      <KaraokeAtmosphere active={active} quality={quality} />
      <pointLight position={[0, 3.25, -2.3]} intensity={(active ? 11 : 5) + serviceLevel * 0.45} distance={11} color={AMBER_PALETTE.karaokeHot} />
      <pointLight position={[-3.8, 2.7, 1.6]} intensity={active ? 8 : 3} distance={8} color={AMBER_PALETTE.karaokeBlue} />
    </group>
  );
}

function SaunaInterior({ active, quality, room }: { active: boolean; quality: number; room: ViewRoom | undefined }) {
  const staffLevel = getUpgradeLevel(room, 'staffSpeed');
  const capacityLevel = getUpgradeLevel(room, 'capacity');
  const serviceLevel = getUpgradeLevel(room, 'quality');
  return (
    <group>
      <RoundedBox args={[10.4, 0.08, 7.7]} radius={0.22} smoothness={3} position={[0.2, 0.11, -0.3]} receiveShadow><meshStandardMaterial color="#b87b45" roughness={0.91} /></RoundedBox>
      {[-4.1, -3.25, -2.4, -1.55, -0.7, 0.15, 1, 1.85, 2.7, 3.55, 4.4].map((x) => <mesh key={x} position={[x, 0.18, -0.25]}><boxGeometry args={[0.055, 0.025, 7.2]} /><meshStandardMaterial color={AMBER_PALETTE.saunaLight} roughness={0.88} /></mesh>)}
      <RoundedBox args={[8.4, 0.5, 1.15]} radius={0.12} smoothness={3} position={[0.25, 0.33, -3.72]} castShadow><meshStandardMaterial color="#bd7940" roughness={0.83} /></RoundedBox>
      {capacityLevel >= 2 && <RoundedBox args={[8.4, 0.48, 1.15]} radius={0.12} smoothness={3} position={[0.25, 0.78, -4.18]} castShadow><meshStandardMaterial color="#d49552" roughness={0.81} /></RoundedBox>}
      {[-3.45, -2.2, -0.95, 0.3, 1.55, 2.8, 4.05].map((x) => <mesh key={x} position={[x, 1.25, -4.65]}><boxGeometry args={[0.075, 1.8, 0.11]} /><meshStandardMaterial color="#e0aa68" roughness={0.84} /></mesh>)}
      <RoundedBox args={[1.2, 1.05, 1.2]} radius={0.14} smoothness={3} position={[2.65, 0.55, 1.2]} castShadow><meshStandardMaterial color="#4d504a" roughness={0.82} metalness={0.08} /></RoundedBox>
      {Array.from({ length: 10 }, (_, index) => {
        const angle = (index / 10) * Math.PI * 2;
        return <mesh key={index} position={[2.65 + Math.cos(angle) * 0.31, 1.16 + (index % 3) * 0.08, 1.2 + Math.sin(angle) * 0.31]}><dodecahedronGeometry args={[0.17, 0]} /><meshStandardMaterial color={index % 2 ? '#765f4d' : '#8c745e'} roughness={0.94} /></mesh>;
      })}
      {serviceLevel >= 3 && <group position={[-3.7, 0, 2.75]}>
        <RoundedBox args={[2.3, 0.62, 2.3]} radius={0.32} smoothness={4} position={[0, 0.34, 0]} castShadow><meshStandardMaterial color="#617e78" roughness={0.7} /></RoundedBox>
        <RoundedBox args={[1.85, 0.14, 1.85]} radius={0.28} smoothness={4} position={[0, 0.69, 0]}><meshPhysicalMaterial color="#8fd0cc" transmission={0.2} transparent opacity={0.78} roughness={0.14} /></RoundedBox>
      </group>}
      {staffLevel >= 2 && <group position={[-0.8, 0.82, 2.8]}>
        <mesh><cylinderGeometry args={[0.38, 0.28, 0.4, 16]} /><meshStandardMaterial color={AMBER_PALETTE.oak} roughness={0.76} /></mesh>
        <mesh position={[0, 0.23, 0]}><torusGeometry args={[0.32, 0.035, 8, 20]} /><meshStandardMaterial color={AMBER_PALETTE.brass} metalness={0.55} roughness={0.28} /></mesh>
      </group>}
      {serviceLevel >= 4 && (
        <RoundedBox args={[3.1, 0.11, 0.22]} radius={0.05} smoothness={2} position={[-1.2, 2.55, -4.67]}>
          <meshStandardMaterial color={AMBER_PALETTE.saunaLight} emissive={AMBER_PALETTE.saunaLight} emissiveIntensity={0.7} roughness={0.42} />
        </RoundedBox>
      )}
      <SaunaSteam active={active} quality={quality} />
      <pointLight position={[1.2, 3.2, -1]} intensity={active ? 9 : 5} distance={12} color={AMBER_PALETTE.saunaLight} />
    </group>
  );
}

function MassageBed({ x, occupied = false }: { x: number; occupied?: boolean }) {
  return (
    <group position={[x, 0, -1.2]}>
      <RoundedBox args={[1.7, 0.5, 3.35]} radius={0.2} smoothness={4} position={[0, 0.62, 0]} castShadow><meshStandardMaterial color="#dac6aa" roughness={0.86} /></RoundedBox>
      <RoundedBox args={[1.26, 0.24, 0.7]} radius={0.17} smoothness={3} position={[0, 0.96, -1.02]}><meshStandardMaterial color={AMBER_PALETTE.massageLight} roughness={0.88} /></RoundedBox>
      {occupied && (
        <group position={[0, 1.05, 0.22]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}><capsuleGeometry args={[0.25, 1.3, 7, 12]} /><meshStandardMaterial color="#d89a72" roughness={0.74} /></mesh>
          <mesh position={[0, 0.02, -0.92]}><sphereGeometry args={[0.27, 14, 10]} /><meshStandardMaterial color="#c98663" roughness={0.7} /></mesh>
          <RoundedBox args={[1.1, 0.08, 1.1]} radius={0.1} smoothness={2} position={[0, 0.15, 0.35]}><meshStandardMaterial color={AMBER_PALETTE.massage} roughness={0.9} /></RoundedBox>
        </group>
      )}
      {[[-0.62, -1.3], [0.62, -1.3], [-0.62, 1.3], [0.62, 1.3]].map(([legX, legZ]) => <mesh key={`${legX}-${legZ}`} position={[legX, 0.28, legZ]}><cylinderGeometry args={[0.055, 0.065, 0.55, 8]} /><meshStandardMaterial color={AMBER_PALETTE.walnut} roughness={0.74} /></mesh>)}
    </group>
  );
}

function MassageInterior({ active, quality, occupiedCount, room }: { active: boolean; quality: number; occupiedCount: number; room: ViewRoom | undefined }) {
  const staffLevel = getUpgradeLevel(room, 'staffSpeed');
  const capacityLevel = getUpgradeLevel(room, 'capacity');
  const serviceLevel = getUpgradeLevel(room, 'quality');
  return (
    <group>
      <RoundedBox args={[10.5, 0.08, 7.7]} radius={0.24} smoothness={4} position={[0, 0.11, -0.15]} receiveShadow><meshStandardMaterial color="#c9ddd3" roughness={0.92} /></RoundedBox>
      <MassageBed x={-2.05} occupied={occupiedCount > 0} />
      {capacityLevel >= 2 && <MassageBed x={2.05} occupied={occupiedCount > 1} />}
      {serviceLevel >= 2 && <RoundedBox args={[4.6, 0.08, 0.2]} radius={0.04} smoothness={2} position={[0, 1.45, -0.15]}><meshPhysicalMaterial color={AMBER_PALETTE.massageLight} roughness={0.48} transmission={0.08} transparent opacity={0.52} /></RoundedBox>}
      {serviceLevel >= 2 && [-2.3, -1.15, 0, 1.15, 2.3].map((x) => <mesh key={x} position={[x, 1.46, -0.15]}><cylinderGeometry args={[0.025, 0.025, 2.7, 8]} /><meshStandardMaterial color={AMBER_PALETTE.brass} metalness={0.45} roughness={0.34} /></mesh>)}
      {capacityLevel >= 4 && <group position={[-4.15, 0, 2.6]}>
        <RoundedBox args={[2.25, 0.56, 1.15]} radius={0.23} smoothness={4} position={[0, 0.33, 0]} castShadow><meshStandardMaterial color={AMBER_PALETTE.massage} roughness={0.82} /></RoundedBox>
        <RoundedBox args={[2.25, 0.72, 0.3]} radius={0.14} smoothness={3} position={[0, 0.72, 0.42]}><meshStandardMaterial color="#78bca6" roughness={0.84} /></RoundedBox>
      </group>}
      {staffLevel >= 2 && <group position={[4.3, 0, -3.65]}>
        <RoundedBox args={[1.35, 1.65, 0.62]} radius={0.12} smoothness={3} position={[0, 0.86, 0]} castShadow><meshStandardMaterial color={AMBER_PALETTE.walnut} roughness={0.78} /></RoundedBox>
        {[-0.35, 0, 0.35].flatMap((x) => [0.42, 0.82, 1.22].map((y) => <mesh key={`${x}-${y}`} position={[x, y, 0.36]}><cylinderGeometry args={[0.07, 0.09, 0.24, 10]} /><meshStandardMaterial color={(Math.round((x + 0.35) * 10) + Math.round(y * 10)) % 2 ? AMBER_PALETTE.honeyLight : AMBER_PALETTE.massageLight} roughness={0.48} /></mesh>))}
      </group>}
      {serviceLevel >= 3 && <Plant position={[4.3, 0.04, 2.85]} scale={0.82} />}
      <Plant position={[-4.5, 0.04, -3.5]} scale={0.75} />
      <MassageAroma active={active} quality={quality} />
      <pointLight position={[0, 3.1, -1.4]} intensity={active ? 8 : 4.5} distance={12} color={AMBER_PALETTE.massageLight} />
    </group>
  );
}

function RenovationScene({ roomId, stage }: { roomId: RoomVenueId; stage: number }) {
  const accent = roomId === 'karaoke' ? AMBER_PALETTE.karaokeHot : roomId === 'sauna' ? AMBER_PALETTE.saunaLight : AMBER_PALETTE.massageLight;
  return (
    <group>
      <RoundedBox args={[7.7, 1.05, 4.4]} radius={0.2} smoothness={3} position={[0, 0.58, -0.35]} castShadow><meshStandardMaterial color="#918276" roughness={0.96} /></RoundedBox>
      {[-2.55, -0.85, 0.85, 2.55].map((x, index) => <RoundedBox key={x} args={[1.45, 0.22, 0.72]} radius={0.08} smoothness={2} position={[x, 1.28 + (index % 2) * 0.14, 2.6]} rotation={[0, index % 2 ? 0.1 : -0.08, 0]} castShadow><meshStandardMaterial color={AMBER_PALETTE.oak} roughness={0.92} /></RoundedBox>)}
      {stage > 0 && (
        <group position={[-3.55, 0, -2.6]}>
          {[-1, 1].map((x) => <mesh key={x} position={[x * 0.7, 1.55, 0]}><cylinderGeometry args={[0.055, 0.055, 3.1, 8]} /><meshStandardMaterial color={AMBER_PALETTE.brass} metalness={0.58} roughness={0.32} /></mesh>)}
          {[0.35, 1.25, 2.2].map((y) => <mesh key={y} position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.04, 0.04, 1.5, 8]} /><meshStandardMaterial color={AMBER_PALETTE.brass} metalness={0.58} roughness={0.32} /></mesh>)}
        </group>
      )}
      <group position={[0, 1.8, 2.52]}>
        <RoundedBox args={[1.45, 0.8, 0.15]} radius={0.09} smoothness={2}><meshStandardMaterial color={AMBER_PALETTE.spruce} roughness={0.72} /></RoundedBox>
        <mesh position={[0, 0, 0.09]}><octahedronGeometry args={[0.23, 0]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} /></mesh>
      </group>
    </group>
  );
}

function BuildingShell() {
  return (
    <group>
      <Floor size={[18, 14]} color="#d9c9ae" />
      <Floor size={[12, 10]} color="#d8ced9" position={[-15, 0, 0]} />
      <Floor size={[12, 10]} color="#d8bd91" position={[15, 0, 0]} />
      <Floor size={[12, 10]} color="#cfe1d8" position={[0, 0, -12]} />

      <Wall args={[7.7, 3.2, 0.3]} position={[-5.15, 1.6, -7]} color={AMBER_PALETTE.spruce} />
      <Wall args={[7.7, 3.2, 0.3]} position={[5.15, 1.6, -7]} color={AMBER_PALETTE.spruce} />
      <Wall args={[0.3, 3.2, 5.8]} position={[-9, 1.6, -4.1]} color={AMBER_PALETTE.terracotta} />
      <Wall args={[0.3, 3.2, 5.8]} position={[-9, 1.6, 4.1]} color={AMBER_PALETTE.terracotta} />
      <Wall args={[0.3, 3.2, 5.8]} position={[9, 1.6, -4.1]} color={AMBER_PALETTE.teal} cutaway />
      <Wall args={[0.3, 3.2, 5.8]} position={[9, 1.6, 4.1]} color={AMBER_PALETTE.teal} cutaway />
      <Wall args={[7.7, 3.2, 0.3]} position={[-5.15, 1.6, 7]} color={AMBER_PALETTE.terracotta} cutaway />
      <Wall args={[7.7, 3.2, 0.3]} position={[5.15, 1.6, 7]} color={AMBER_PALETTE.terracotta} cutaway />

      <Wall args={[12, 3.2, 0.3]} position={[-15, 1.6, -5]} color="#4f3b68" />
      <Wall args={[0.3, 3.2, 10]} position={[-21, 1.6, 0]} color="#5c4379" />
      <Wall args={[12, 3.2, 0.3]} position={[-15, 1.6, 5]} color="#5c4379" cutaway />

      <Wall args={[12, 3.2, 0.3]} position={[15, 1.6, -5]} color="#a76b38" />
      <Wall args={[0.3, 3.2, 10]} position={[21, 1.6, 0]} color="#a76b38" cutaway />
      <Wall args={[12, 3.2, 0.3]} position={[15, 1.6, 5]} color="#a76b38" cutaway />

      <Wall args={[12, 3.2, 0.3]} position={[0, 1.6, -17]} color={AMBER_PALETTE.massage} />
      <Wall args={[0.3, 3.2, 10]} position={[-6, 1.6, -12]} color="#3e8973" />
      <Wall args={[0.3, 3.2, 10]} position={[6, 1.6, -12]} color="#3e8973" cutaway />

      <WallTrim args={[7.35, 0.12, 0.08]} position={[-5.15, 1.05, -6.82]} />
      <WallTrim args={[7.35, 0.12, 0.08]} position={[5.15, 1.05, -6.82]} />
      <InternalDoor axis="x" position={[-9, 0, 0]} accent={AMBER_PALETTE.karaokeHot} openDirection={-1} />
      <InternalDoor axis="x" position={[9, 0, 0]} accent={AMBER_PALETTE.saunaLight} openDirection={1} />
      <InternalDoor axis="z" position={[0, 0, -7]} accent={AMBER_PALETTE.massageLight} openDirection={-1} />
    </group>
  );
}

const getRoom = (snapshot: ViewSnapshot, roomId: RoomVenueId) => snapshot.rooms.find((room) => room.id === roomId);
const roomIsActive = (room: ViewRoom | undefined) => room?.status === 'serving' || room?.status === 'welcoming';

function RoomContent({
  roomId,
  room,
  quality,
  reducedMotion,
}: {
  roomId: RoomVenueId;
  room: ViewRoom | undefined;
  quality: number;
  reducedMotion: boolean;
}) {
  const layout = AMBER_LAYOUT[roomId];
  const stage = room?.renovationStage ?? 3;
  const showInterior = room ? room.unlocked || stage >= 2 : true;
  const active = roomIsActive(room);
  return (
    <group position={[layout.center.x, 0, layout.center.z]}>
      {showInterior ? (
        roomId === 'karaoke'
          ? <KaraokeInterior active={active && !reducedMotion} quality={quality} room={room} />
          : roomId === 'sauna'
            ? <SaunaInterior active={active && !reducedMotion} quality={quality} room={room} />
            : <MassageInterior active={active && !reducedMotion} quality={quality} occupiedCount={room?.guests ?? 0} room={room} />
      ) : <RenovationScene roomId={roomId} stage={stage} />}
    </group>
  );
}

function ZonedLighting({ focus, quality }: { focus: VenueId; quality: number }) {
  return (
    <>
      <hemisphereLight args={[AMBER_PALETTE.cream, '#315757', 0.9]} />
      <directionalLight
        castShadow={quality > 0.7}
        position={[11, 19, 13]}
        intensity={2.15}
        color="#ffe0ae"
        shadow-mapSize-width={quality > 0.9 ? 1536 : 1024}
        shadow-mapSize-height={quality > 0.9 ? 1536 : 1024}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={32}
        shadow-camera-bottom={-32}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-bias={-0.00015}
      />
      <pointLight position={[0, 4.8, 0]} intensity={focus === 'bar' ? 8 : 4} distance={18} color={AMBER_PALETTE.honeyLight} />
      <pointLight position={[-15, 4, 0]} intensity={focus === 'karaoke' ? 7 : 2.4} distance={15} color={AMBER_PALETTE.karaokeHot} />
      <pointLight position={[15, 4, 0]} intensity={focus === 'sauna' ? 7 : 2.4} distance={15} color={AMBER_PALETTE.saunaLight} />
      <pointLight position={[0, 4, -12]} intensity={focus === 'massage' ? 7 : 2.4} distance={15} color={AMBER_PALETTE.massageLight} />
    </>
  );
}

export type AmberVenueProps = {
  snapshot: ViewSnapshot;
  focus: VenueId;
  drawerOpen: boolean;
  quality?: AmberQuality;
  reducedMotion?: boolean;
};

export function AmberVenue({ snapshot, focus, drawerOpen, quality = 'auto', reducedMotion = false }: AmberVenueProps) {
  const qualityRatio = quality === 'mobile' ? 0.58 : quality === 'high' ? 1 : 0.82;
  return (
    <>
      <color attach="background" args={['#a9d3ca']} />
      <mesh position={[0, -0.28, -4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[72, 58]} />
        <meshStandardMaterial color={AMBER_PALETTE.backdrop} roughness={1} />
      </mesh>
      <BuildingShell />
      <MainBarInterior />
      {ROOM_ORDER.map((roomId) => (
        <RoomContent
          key={roomId}
          roomId={roomId}
          room={getRoom(snapshot, roomId)}
          quality={qualityRatio}
          reducedMotion={reducedMotion}
        />
      ))}
      {snapshot.characters.map((character) => (
        <AmberCharacter key={character.id} character={character} reducedMotion={reducedMotion} />
      ))}
      <AmberEventVfx event={snapshot.lastEvent} reducedMotion={reducedMotion} />
      <ZonedLighting focus={focus} quality={qualityRatio} />
      <AmberCameraRig focus={focus} drawerOpen={drawerOpen} reducedMotion={reducedMotion} />
    </>
  );
}

export type AmberVenueGroupProps = ThreeElements['group'];
