import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { StaffCharacterId } from '../game/types';
import { FurryStaff, type FurryOutfit, type FurryPose, type FurrySpecies } from './FurryStaff';

/** Map each roster character to a distinct base silhouette + palette variant. */
const MESH_BASE: Record<StaffCharacterId, { species: FurrySpecies; scale: number; accent?: string }> = {
  christina: { species: 'rabbit', scale: 1.0 },
  tigra: { species: 'tiger', scale: 1.08 },
  winna: { species: 'bear', scale: 1.12 },
  krolya: { species: 'rabbit', scale: 1.02 },
  ia: { species: 'bear', scale: 1.0 },
  piggy: { species: 'rabbit', scale: 0.95 },
  ru: { species: 'tiger', scale: 0.92 },
  mama_ru: { species: 'tiger', scale: 1.1 },
  sova: { species: 'bear', scale: 1.0 },
};

/** Extra tint overrides so each of 9 reads unique even when sharing a base mesh family. */
const TINT: Record<StaffCharacterId, string> = {
  christina: '#ff5fa0',
  tigra: '#ff7a1a',
  winna: '#d9922e',
  krolya: '#f0c090',
  ia: '#7d8a9c',
  piggy: '#ff8fa8',
  ru: '#e0a060',
  mama_ru: '#c87848',
  sova: '#c8b878',
};

/**
 * Unique staff body for roster characters.
 * Uses distinct species bases + per-id scale/tint accessories for clear identity.
 */
export function StaffCharacter({
  characterId,
  pose = 'idle',
  active = false,
  speedLevel = 1,
  position = [0, 0, 0],
  rotation = 0,
  scale = 1,
  outfit = 'dressed',
}: {
  characterId: StaffCharacterId;
  pose?: FurryPose;
  active?: boolean;
  speedLevel?: number;
  position?: [number, number, number];
  rotation?: number;
  scale?: number;
  outfit?: FurryOutfit;
}) {
  const base = MESH_BASE[characterId];
  const accessory = useRef<THREE.Group>(null);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame(({ clock }) => {
    if (!accessory.current) return;
    const t = clock.elapsedTime * 1.4 + phase;
    if (characterId === 'sova') {
      accessory.current.rotation.z = Math.sin(t) * 0.12;
    } else if (characterId === 'ru' || characterId === 'mama_ru') {
      accessory.current.position.y = Math.abs(Math.sin(t * 1.6)) * 0.04;
    }
  });

  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale * base.scale}>
      <FurryStaff
        species={base.species}
        pose={pose}
        active={active}
        speedLevel={speedLevel}
        position={[0, 0, 0]}
        rotation={0}
        scale={1}
        outfit={outfit}
      />
      {/* Identity accessories — silhouette cues per character */}
      <group ref={accessory} position={[0, 0, 0]}>
        {characterId === 'christina' && (
          <mesh position={[0, 1.72, 0.02]}>
            <sphereGeometry args={[0.12, 10, 8]} />
            <meshStandardMaterial color="#2a1810" roughness={0.7} />
          </mesh>
        )}
        {characterId === 'ia' && (
          <>
            {([-0.12, 0.12] as const).map((x) => (
              <mesh key={x} position={[x, 1.95, -0.02]} rotation={[0.2, 0, x > 0 ? 0.25 : -0.25]}>
                <boxGeometry args={[0.06, 0.35, 0.04]} />
                <meshStandardMaterial color={TINT.ia} roughness={0.8} />
              </mesh>
            ))}
            <mesh position={[0, 1.55, 0.22]}>
              <boxGeometry args={[0.16, 0.1, 0.18]} />
              <meshStandardMaterial color="#4a5560" roughness={0.75} />
            </mesh>
          </>
        )}
        {characterId === 'piggy' && (
          <mesh position={[0, 1.55, 0.28]}>
            <cylinderGeometry args={[0.08, 0.09, 0.1, 10]} />
            <meshStandardMaterial color={TINT.piggy} roughness={0.65} />
          </mesh>
        )}
        {(characterId === 'ru' || characterId === 'mama_ru') && (
          <mesh position={[0, 0.55, 0.22]} scale={characterId === 'mama_ru' ? 1.25 : 1}>
            <sphereGeometry args={[0.16, 12, 10]} />
            <meshStandardMaterial color={TINT[characterId]} roughness={0.7} />
          </mesh>
        )}
        {characterId === 'sova' && (
          <>
            {([-0.55, 0.55] as const).map((x) => (
              <mesh key={x} position={[x, 1.35, -0.05]} rotation={[0, 0, x > 0 ? -0.5 : 0.5]}>
                <boxGeometry args={[0.55, 0.08, 0.28]} />
                <meshStandardMaterial color={TINT.sova} roughness={0.72} />
              </mesh>
            ))}
            <mesh position={[0, 1.85, 0]}>
              <coneGeometry args={[0.12, 0.18, 8]} />
              <meshStandardMaterial color="#8a7850" roughness={0.7} />
            </mesh>
          </>
        )}
        {characterId === 'krolya' && (
          <mesh position={[0, 1.55, 0.2]}>
            <sphereGeometry args={[0.05, 8, 6]} />
            <meshStandardMaterial color="#fff" roughness={0.4} />
          </mesh>
        )}
        {characterId === 'winna' && (
          <mesh position={[0, 1.7, -0.05]}>
            <sphereGeometry args={[0.14, 10, 8]} />
            <meshStandardMaterial color="#f2d36a" roughness={0.65} />
          </mesh>
        )}
        {characterId === 'tigra' && (
          <mesh position={[0, 1.0, 0.2]}>
            <torusGeometry args={[0.16, 0.025, 6, 16]} />
            <meshStandardMaterial color="#ffcc66" metalness={0.45} roughness={0.35} />
          </mesh>
        )}
      </group>
      {/* Colored waist sash — a quick per-character identity cue shared by all bases */}
      <mesh position={[0, 1.06, 0.02]} castShadow>
        <torusGeometry args={[0.27, 0.05, 8, 18]} />
        <meshStandardMaterial color={TINT[characterId]} roughness={0.55} emissive={TINT[characterId]} emissiveIntensity={0.18} />
      </mesh>
      {/* Soft identity glow tint */}
      <pointLight intensity={0.35} distance={2.2} color={TINT[characterId]} position={[0, 1.4, 0.4]} />
    </group>
  );
}
