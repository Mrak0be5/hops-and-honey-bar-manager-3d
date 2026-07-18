import { RoundedBox, Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GUEST_CHAIR_OFFSET, TABLE_RADIUS } from '../game/config';
import type { TableState } from '../game/types';
import { BeerMug } from './Character';

const tileColors = ['#f7e1bb', '#ffd9b9', '#f2cda4'];

function FloorTiles() {
  const floor = useRef<THREE.InstancedMesh>(null);
  const tiles = useMemo(() => {
    const result: { x: number; z: number; color: string }[] = [];
    for (let x = -7; x <= 7; x += 1) {
      for (let z = -5; z <= 5; z += 1) {
        result.push({ x, z, color: tileColors[Math.abs(x * 7 + z * 3) % tileColors.length] });
      }
    }
    return result;
  }, []);

  useLayoutEffect(() => {
    if (!floor.current) return;
    const transform = new THREE.Object3D();
    tiles.forEach((tile, index) => {
      transform.position.set(tile.x, 0, tile.z);
      transform.updateMatrix();
      floor.current?.setMatrixAt(index, transform.matrix);
      floor.current?.setColorAt(index, new THREE.Color(tile.color));
    });
    floor.current.instanceMatrix.needsUpdate = true;
    if (floor.current.instanceColor) floor.current.instanceColor.needsUpdate = true;
  }, [tiles]);

  return (
    <instancedMesh ref={floor} args={[undefined, undefined, tiles.length]} receiveShadow position={[0, 0.015, 0]}>
      <boxGeometry args={[0.94, 0.035, 0.94]} />
      <meshStandardMaterial roughness={0.92} />
    </instancedMesh>
  );
}

function Chair({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RoundedBox args={[0.72, 0.15, 0.72]} radius={0.1} smoothness={3} position={[0, 0.54, 0]} castShadow>
        <meshStandardMaterial color="#157f80" roughness={0.72} />
      </RoundedBox>
      <RoundedBox args={[0.57, 0.1, 0.56]} radius={0.08} smoothness={3} position={[0, 0.65, 0.015]} castShadow>
        <meshStandardMaterial color="#f4a33e" roughness={0.58} />
      </RoundedBox>
      <RoundedBox args={[0.72, 0.74, 0.15]} radius={0.09} smoothness={3} position={[0, 0.85, -0.31]} castShadow>
        <meshStandardMaterial color="#ef5c4f" roughness={0.7} />
      </RoundedBox>
      <RoundedBox args={[0.51, 0.47, 0.055]} radius={0.08} smoothness={3} position={[0, 0.88, -0.405]} castShadow>
        <meshStandardMaterial color="#0d777b" roughness={0.64} />
      </RoundedBox>
      {[-0.27, 0.27].map((x) => [-0.27, 0.27].map((z) => (
        <mesh key={`${x}-${z}`} castShadow position={[x, 0.27, z]}>
          <cylinderGeometry args={[0.045, 0.055, 0.55, 8]} />
          <meshStandardMaterial color="#43382f" roughness={0.9} />
        </mesh>
      )))}
    </group>
  );
}

function DirtyWisps() {
  const wisps = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!wisps.current) return;
    wisps.current.children.forEach((child, index) => {
      const progress = (clock.elapsedTime * (0.24 + index * 0.035) + index * 0.31) % 1;
      child.position.y = progress * 0.72;
      child.position.x = Math.sin(progress * Math.PI * 2 + index) * 0.08;
      child.scale.setScalar(0.6 + progress * 0.55);
      const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity = Math.sin(progress * Math.PI) * 0.32;
    });
  });
  return (
    <group ref={wisps} position={[0, 0.28, 0]}>
      {[0, 1, 2].map((index) => (
        <mesh key={index} position={[index * 0.08 - 0.08, 0, 0]}>
          <sphereGeometry args={[0.085, 8, 6]} />
          <meshBasicMaterial color="#7d9d74" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function TableCandle({ seed }: { seed: number }) {
  const flame = useRef<THREE.MeshStandardMaterial>(null);
  const glow = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const pulse = 0.92 + Math.sin(clock.elapsedTime * 4.7 + seed * 1.73) * 0.08 + Math.sin(clock.elapsedTime * 7.9 + seed) * 0.04;
    if (flame.current) flame.current.emissiveIntensity = 1.35 + pulse * 0.75;
    if (glow.current) glow.current.scale.setScalar(pulse);
  });

  return (
    <group position={[0.29, 0.91, -0.18]}>
      <mesh castShadow position={[0, 0.11, 0]}>
        <cylinderGeometry args={[0.07, 0.08, 0.22, 10]} />
        <meshStandardMaterial color="#fff0c9" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial ref={flame} color="#ffd35c" emissive="#ff9d3d" emissiveIntensity={2} roughness={0.35} />
      </mesh>
      <mesh ref={glow} position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.15, 10, 8]} />
        <meshBasicMaterial color="#ffc55c" transparent opacity={0.1} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Table({ table }: { table: TableState }) {
  return (
    <group position={[table.position.x, 0, table.position.z]}>
      <mesh castShadow receiveShadow position={[0, 0.78, 0]}>
        <cylinderGeometry args={[TABLE_RADIUS - 0.03, TABLE_RADIUS, 0.18, 32]} />
        <meshStandardMaterial color="#b84e3f" roughness={0.66} />
      </mesh>
      <mesh position={[0, 0.88, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[TABLE_RADIUS - 0.065, 0.035, 8, 32]} />
        <meshStandardMaterial color="#f39c3d" roughness={0.42} metalness={0.08} />
      </mesh>
      <mesh castShadow position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.13, 0.24, 0.72, 12]} />
        <meshStandardMaterial color="#6f3a32" roughness={0.82} />
      </mesh>
      <mesh receiveShadow position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.42, 0.48, 0.14, 16]} />
        <meshStandardMaterial color="#4f3530" roughness={0.9} />
      </mesh>
      <mesh position={[-0.27, 0.89, -0.06]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.18, 20]} />
        <meshStandardMaterial color="#ffe4a7" roughness={0.8} />
      </mesh>
      <TableCandle seed={table.id} />
      <Chair position={[0, 0, GUEST_CHAIR_OFFSET]} rotation={Math.PI} />
      <Chair position={[-0.96, 0, -0.05]} rotation={-Math.PI / 2} />
      {table.dirty && (
        <group position={[0.23, 0.91, 0.02]}>
          <BeerMug dirty scale={0.82} />
          <group position={[-0.28, 0, 0.12]} rotation={[0, 0.3, 0.18]}><BeerMug dirty scale={0.68} /></group>
          <DirtyWisps />
        </group>
      )}
    </group>
  );
}

function Bottle({ x, color, height = 0.55 }: { x: number; color: string; height?: number }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh castShadow position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.11, 0.14, height, 10]} />
        <meshStandardMaterial color={color} roughness={0.28} metalness={0.05} />
      </mesh>
      <mesh castShadow position={[0, height + 0.09, 0]}>
        <cylinderGeometry args={[0.055, 0.075, 0.2, 10]} />
        <meshStandardMaterial color={color} roughness={0.26} />
      </mesh>
      <mesh position={[0, height + 0.2, 0]}>
        <cylinderGeometry args={[0.062, 0.062, 0.05, 10]} />
        <meshStandardMaterial color="#f2c05a" metalness={0.25} />
      </mesh>
    </group>
  );
}

function BarCounter() {
  return (
    <group>
      <RoundedBox args={[6.2, 1.22, 0.86]} radius={0.17} smoothness={4} position={[-0.25, 0.61, -3.63]} castShadow receiveShadow>
        <meshStandardMaterial color="#b83f3e" roughness={0.68} />
      </RoundedBox>
      <RoundedBox args={[6.5, 0.18, 1.08]} radius={0.1} smoothness={4} position={[-0.25, 1.25, -3.63]} castShadow>
        <meshStandardMaterial color="#f4bd68" roughness={0.5} />
      </RoundedBox>
      {[[-2.25, '#ef5c52'], [-0.25, '#14a6a2'], [1.75, '#f39f35']].map(([x, color]) => (
        <RoundedBox key={x} args={[1.55, 0.7, 0.05]} radius={0.08} smoothness={3} position={[Number(x), 0.58, -3.17]}>
          <meshStandardMaterial color={String(color)} roughness={0.75} />
        </RoundedBox>
      ))}
      <mesh castShadow position={[-0.25, 0.3, -3.05]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.055, 0.055, 5.45, 12]} />
        <meshStandardMaterial color="#f3c567" metalness={0.42} roughness={0.35} />
      </mesh>
      {[-2.4, -0.25, 1.9].map((x) => (
        <mesh key={x} castShadow position={[x, 0.3, -3.18]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.28, 10]} />
          <meshStandardMaterial color="#eab759" metalness={0.36} roughness={0.38} />
        </mesh>
      ))}
      <group position={[-1.25, 1.35, -3.45]}>
        <mesh castShadow position={[0, 0.28, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.52, 10]} />
          <meshStandardMaterial color="#334d53" metalness={0.3} roughness={0.35} />
        </mesh>
        <mesh castShadow position={[0.18, 0.55, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.06, 0.06, 0.36, 10]} />
          <meshStandardMaterial color="#efaa32" metalness={0.25} />
        </mesh>
      </group>

      <group position={[-1.4, 0.95, -5.25]}>
        <RoundedBox args={[4.7, 2.2, 0.34]} radius={0.12} smoothness={3} position={[0, 0.25, 0]} castShadow>
          <meshStandardMaterial color="#0b6b72" roughness={0.74} />
        </RoundedBox>
        {[-0.45, 0.35].map((y) => (
          <mesh key={y} position={[0, y, 0.24]} castShadow>
            <boxGeometry args={[4.35, 0.11, 0.38]} />
            <meshStandardMaterial color="#f1b65f" roughness={0.62} />
          </mesh>
        ))}
        <group position={[-1.3, -0.37, 0.5]}>
          <Bottle x={-0.62} color="#4fa558" />
          <Bottle x={-0.22} color="#e96835" height={0.46} />
          <Bottle x={0.18} color="#3678aa" height={0.6} />
          <Bottle x={0.58} color="#d1436d" height={0.5} />
        </group>
        <group position={[1.05, 0.42, 0.5]}>
          <Bottle x={-0.55} color="#eab338" height={0.45} />
          <Bottle x={-0.15} color="#46a587" height={0.57} />
          <Bottle x={0.25} color="#ce4d51" height={0.49} />
          <Bottle x={0.65} color="#5d6fd1" height={0.61} />
        </group>
      </group>
    </group>
  );
}

function PendantLamp({ position, color }: { position: [number, number, number]; color: string }) {
  const bulb = useRef<THREE.MeshStandardMaterial>(null);
  const glow = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const pulse = 0.96 + Math.sin(clock.elapsedTime * 2.1 + position[0]) * 0.04;
    if (bulb.current) bulb.current.emissiveIntensity = 2.2 + pulse * 0.7;
    if (glow.current) glow.current.scale.setScalar(pulse);
  });

  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.78, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 1.55, 8]} />
        <meshStandardMaterial color="#173f48" metalness={0.45} roughness={0.38} />
      </mesh>
      <mesh castShadow position={[0, -0.02, 0]}>
        <coneGeometry args={[0.42, 0.35, 20, 1, true]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.45} metalness={0.12} />
      </mesh>
      <mesh position={[0, -0.21, 0]}>
        <sphereGeometry args={[0.13, 12, 9]} />
        <meshStandardMaterial ref={bulb} color="#fff1b2" emissive="#ffb545" emissiveIntensity={2.8} roughness={0.3} />
      </mesh>
      <mesh ref={glow} position={[0, -0.21, 0]}>
        <sphereGeometry args={[0.28, 12, 9]} />
        <meshBasicMaterial color="#ffd27a" transparent opacity={0.08} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Plant({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const leaves = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (leaves.current) leaves.current.rotation.y = Math.sin(clock.elapsedTime * 0.45 + position[0]) * 0.08;
  });
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.28, 0.23, 0.55, 12]} />
        <meshStandardMaterial color="#fff1cf" roughness={0.78} />
      </mesh>
      <group ref={leaves} position={[0, 0.55, 0]}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <mesh key={index} castShadow position={[Math.cos(index) * 0.23, 0.28 + (index % 2) * 0.17, Math.sin(index) * 0.23]} rotation={[0.25, index, 0.45]}>
            <sphereGeometry args={[0.19, 10, 8]} />
            <meshStandardMaterial color={index % 2 ? '#22a66f' : '#43be78'} roughness={0.78} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Entrance() {
  return (
    <group position={[7.2, 0, 4.6]} rotation={[0, -Math.PI / 2, 0]}>
      <RoundedBox args={[2.2, 3.2, 0.35]} radius={0.16} smoothness={3} position={[0, 1.58, 0]} castShadow>
        <meshStandardMaterial color="#0a7c82" roughness={0.72} />
      </RoundedBox>
      <RoundedBox args={[1.62, 2.65, 0.42]} radius={0.13} smoothness={3} position={[0, 1.35, 0.18]}>
        <meshStandardMaterial color="#ef8144" roughness={0.74} />
      </RoundedBox>
      <mesh position={[0.58, 1.35, 0.42]}>
        <sphereGeometry args={[0.08, 10, 8]} />
        <meshStandardMaterial color="#ffe27d" metalness={0.45} roughness={0.25} />
      </mesh>
    </group>
  );
}

export function BarEnvironment({ tables }: { tables: TableState[] }) {
  return (
    <group>
      <mesh receiveShadow position={[0, -0.22, 0]}>
        <boxGeometry args={[16.4, 0.42, 12.4]} />
        <meshStandardMaterial color="#9d4a45" roughness={0.9} />
      </mesh>
      <FloorTiles />

      <mesh receiveShadow castShadow position={[0, 1.7, -6.05]}>
        <boxGeometry args={[16.4, 3.4, 0.38]} />
        <meshStandardMaterial color="#0f8588" roughness={0.82} />
      </mesh>
      <mesh receiveShadow castShadow position={[-8.05, 1.7, 0]}>
        <boxGeometry args={[0.38, 3.4, 12.4]} />
        <meshStandardMaterial color="#ef684f" roughness={0.82} />
      </mesh>
      <mesh position={[0, 1.23, -5.82]}>
        <boxGeometry args={[16, 0.18, 0.08]} />
        <meshStandardMaterial color="#ffe3a4" roughness={0.75} />
      </mesh>
      <mesh position={[-7.82, 1.23, 0]}>
        <boxGeometry args={[0.08, 0.18, 12]} />
        <meshStandardMaterial color="#ffe3a4" roughness={0.75} />
      </mesh>

      <RoundedBox args={[4.2, 0.08, 1.75]} radius={0.24} smoothness={4} position={[0, 0.09, -2.35]} receiveShadow>
        <meshStandardMaterial color="#147f83" roughness={0.92} />
      </RoundedBox>
      <RoundedBox args={[3.8, 0.09, 1.25]} radius={0.2} smoothness={4} position={[4.8, 0.1, 3.72]} receiveShadow>
        <meshStandardMaterial color="#f05c50" roughness={0.9} />
      </RoundedBox>

      <PendantLamp position={[-3.2, 3.38, -0.2]} color="#ef6651" />
      <PendantLamp position={[0.2, 3.52, 0.35]} color="#0b8587" />
      <PendantLamp position={[3.5, 3.34, 1.65]} color="#f3a43e" />

      <BarCounter />
      {tables.map((table) => <Table key={table.id} table={table} />)}
      <Entrance />
      <Plant position={[-6.9, 0, -4.9]} scale={1.15} />
      <Plant position={[6.7, 0, -4.9]} scale={0.95} />
      <Plant position={[-6.95, 0, 5.05]} scale={0.85} />

      <group position={[-7.79, 2.12, 2.4]} rotation={[0, Math.PI / 2, 0]}>
        {[-0.72, 0, 0.72].map((x, index) => (
          <group key={x} position={[x, 0, 0]}>
            <RoundedBox args={[0.55, 0.72, 0.08]} radius={0.05} smoothness={2}>
              <meshStandardMaterial color={index === 1 ? '#ffd36b' : '#fff0cb'} roughness={0.7} />
            </RoundedBox>
            <mesh position={[0, 0, 0.055]}>
              <circleGeometry args={[0.17, 18]} />
              <meshStandardMaterial color={index === 0 ? '#12a5a1' : index === 1 ? '#ed5f51' : '#eea43a'} roughness={0.58} />
            </mesh>
          </group>
        ))}
      </group>

      <group position={[-5.7, 2.15, -5.78]}>
        <RoundedBox args={[2.65, 1.05, 0.12]} radius={0.12} smoothness={3}>
          <meshStandardMaterial color="#f7d377" roughness={0.66} />
        </RoundedBox>
      </group>
      <Sparkles count={22} scale={[7, 2.4, 1]} position={[0, 1.5, -5.25]} size={1.4} speed={0.22} color="#ffd66f" />
    </group>
  );
}
