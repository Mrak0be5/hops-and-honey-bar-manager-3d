import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

export type FurrySpecies = 'bear' | 'rabbit' | 'tiger';
export type FurryPose =
  | 'idle'
  | 'strip_pole'
  | 'strip_floor'
  | 'sex_cowgirl'
  | 'sex_missionary'
  | 'gangbang_center'
  | 'reclining_guest';

type Palette = {
  fur: string;
  belly: string;
  hair: string;
  eye: string;
  nose: string;
  nipple: string;
  pad: string;
  stripe?: string;
};

const PALETTES: Record<FurrySpecies, Palette> = {
  bear: {
    fur: '#c99255',
    belly: '#f0d7b4',
    hair: '#f2d36a',
    eye: '#8a4a1c',
    nose: '#1a1210',
    nipple: '#e8a090',
    pad: '#3a2a24',
  },
  rabbit: {
    fur: '#d2a574',
    belly: '#f7efe4',
    hair: '#a85a3a',
    eye: '#c47a28',
    nose: '#d07078',
    nipple: '#e8a0a8',
    pad: '#c48a78',
  },
  tiger: {
    fur: '#e88828',
    belly: '#f5f0e8',
    hair: '#f2f0ec',
    eye: '#3d8a45',
    nose: '#e8a0a8',
    nipple: '#e89098',
    pad: '#e8a098',
    stripe: '#1a1210',
  },
};

function StripeBand({ color, args, position, rotation }: {
  color: string;
  args: [number, number, number];
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} roughness={0.82} />
    </mesh>
  );
}

function BreastPair({ palette, scale = 1 }: { palette: Palette; scale?: number }) {
  return (
    <group position={[0, 1.18, 0.18]} scale={scale}>
      {([-0.14, 0.14] as const).map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh castShadow scale={[1.05, 0.92, 0.88]}>
            <sphereGeometry args={[0.145, 14, 12]} />
            <meshStandardMaterial color={palette.belly} roughness={0.62} />
          </mesh>
          <mesh position={[0, -0.01, 0.12]}>
            <sphereGeometry args={[0.035, 10, 8]} />
            <meshStandardMaterial color={palette.nipple} roughness={0.55} />
          </mesh>
          <mesh position={[0, -0.01, 0.145]}>
            <sphereGeometry args={[0.016, 8, 6]} />
            <meshStandardMaterial color={palette.nipple} roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Genitals({ palette, rear = false }: { palette: Palette; rear?: boolean }) {
  if (rear) {
    return (
      <group position={[0, 0.78, -0.14]}>
        <mesh position={[0, 0.02, -0.02]} scale={[0.9, 0.7, 0.55]}>
          <sphereGeometry args={[0.05, 10, 8]} />
          <meshStandardMaterial color={palette.nipple} roughness={0.55} />
        </mesh>
        <mesh position={[0, -0.05, 0.01]} scale={[1.1, 0.55, 0.7]}>
          <sphereGeometry args={[0.055, 10, 8]} />
          <meshStandardMaterial color="#c87880" roughness={0.55} />
        </mesh>
      </group>
    );
  }
  return (
    <group position={[0, 0.72, 0.12]}>
      <mesh scale={[1.15, 0.55, 0.7]}>
        <sphereGeometry args={[0.07, 12, 8]} />
        <meshStandardMaterial color={palette.belly} roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.02, 0.04]} scale={[0.7, 0.45, 0.55]}>
        <sphereGeometry args={[0.045, 10, 8]} />
        <meshStandardMaterial color="#c87880" roughness={0.52} />
      </mesh>
      <mesh position={[-0.025, -0.015, 0.055]} scale={[0.35, 0.55, 0.35]}>
        <sphereGeometry args={[0.03, 8, 6]} />
        <meshStandardMaterial color="#b86870" roughness={0.5} />
      </mesh>
      <mesh position={[0.025, -0.015, 0.055]} scale={[0.35, 0.55, 0.35]}>
        <sphereGeometry args={[0.03, 8, 6]} />
        <meshStandardMaterial color="#b86870" roughness={0.5} />
      </mesh>
    </group>
  );
}

function PawHand({ palette, side }: { palette: Palette; side: 1 | -1 }) {
  return (
    <group>
      <mesh castShadow>
        <sphereGeometry args={[0.1, 10, 8]} />
        <meshStandardMaterial color={palette.fur} roughness={0.72} />
      </mesh>
      <mesh position={[0, -0.02, 0.06]} scale={[0.85, 0.55, 0.35]}>
        <sphereGeometry args={[0.08, 8, 6]} />
        <meshStandardMaterial color={palette.pad} roughness={0.8} />
      </mesh>
      {[ -0.05, 0, 0.05 ].map((x, i) => (
        <mesh key={i} position={[x * side, -0.05, 0.08]} rotation={[0.4, 0, 0]}>
          <capsuleGeometry args={[0.018, 0.04, 4, 6]} />
          <meshStandardMaterial color={palette.fur} />
        </mesh>
      ))}
    </group>
  );
}

function PawFoot({ palette, species }: { palette: Palette; species: FurrySpecies }) {
  const wide = species === 'bear';
  return (
    <group rotation={[0.15, 0, 0]}>
      <mesh castShadow scale={[wide ? 1.25 : 1, 0.7, wide ? 1.35 : 1.15]}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <meshStandardMaterial color={palette.fur} roughness={0.78} />
      </mesh>
      <mesh position={[0, -0.04, 0.02]} scale={[0.9, 0.35, 0.7]}>
        <sphereGeometry args={[0.1, 8, 6]} />
        <meshStandardMaterial color={palette.pad} roughness={0.85} />
      </mesh>
    </group>
  );
}

function Head({ species, palette }: { species: FurrySpecies; palette: Palette }) {
  const snoutZ = species === 'bear' ? 0.22 : species === 'rabbit' ? 0.16 : 0.18;
  return (
    <group position={[0, 1.58, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[species === 'bear' ? 0.3 : 0.27, 16, 14]} />
        <meshStandardMaterial color={palette.fur} roughness={0.72} />
      </mesh>
      {/* muzzle */}
      <mesh castShadow position={[0, -0.04, snoutZ]} scale={[species === 'bear' ? 1.1 : 0.85, 0.7, 0.9]}>
        <sphereGeometry args={[0.14, 12, 10]} />
        <meshStandardMaterial color={palette.belly} roughness={0.68} />
      </mesh>
      <mesh position={[0, -0.01, snoutZ + 0.1]}>
        <sphereGeometry args={[species === 'bear' ? 0.055 : 0.04, 10, 8]} />
        <meshStandardMaterial color={palette.nose} roughness={0.45} />
      </mesh>
      {/* eyes */}
      {([-0.1, 0.1] as const).map((x) => (
        <group key={x} position={[x, 0.05, 0.22]}>
          <mesh>
            <sphereGeometry args={[0.045, 10, 8]} />
            <meshStandardMaterial color="#f8f4ef" />
          </mesh>
          <mesh position={[0, 0, 0.03]}>
            <sphereGeometry args={[0.028, 10, 8]} />
            <meshStandardMaterial color={palette.eye} />
          </mesh>
          <mesh position={[0.01, 0.01, 0.045]}>
            <sphereGeometry args={[0.01, 6, 6]} />
            <meshStandardMaterial color="#111" />
          </mesh>
        </group>
      ))}
      {/* smile */}
      <mesh position={[0, -0.1, snoutZ + 0.05]} rotation={[0.2, 0, 0]}>
        <torusGeometry args={[0.05, 0.008, 6, 12, Math.PI]} />
        <meshStandardMaterial color="#5a3030" />
      </mesh>
      {/* hair */}
      {species === 'tiger' ? (
        <mesh castShadow position={[0, 0.16, -0.02]} scale={[1.05, 0.55, 1]}>
          <sphereGeometry args={[0.28, 12, 10]} />
          <meshStandardMaterial color={palette.hair} roughness={0.85} />
        </mesh>
      ) : (
        <>
          <mesh castShadow position={[0, 0.12, -0.08]} scale={[1.15, 0.85, 1.1]}>
            <sphereGeometry args={[0.3, 14, 12]} />
            <meshStandardMaterial color={palette.hair} roughness={0.88} />
          </mesh>
          <mesh castShadow position={[0.18, 0.05, -0.2]} scale={[0.7, 1.4, 0.7]}>
            <sphereGeometry args={[0.16, 10, 8]} />
            <meshStandardMaterial color={palette.hair} roughness={0.88} />
          </mesh>
          <mesh castShadow position={[-0.18, 0.05, -0.2]} scale={[0.7, 1.4, 0.7]}>
            <sphereGeometry args={[0.16, 10, 8]} />
            <meshStandardMaterial color={palette.hair} roughness={0.88} />
          </mesh>
          <mesh castShadow position={[0, -0.15, -0.28]} scale={[0.9, 1.6, 0.6]}>
            <sphereGeometry args={[0.18, 10, 8]} />
            <meshStandardMaterial color={palette.hair} roughness={0.9} />
          </mesh>
        </>
      )}
      {/* ears */}
      {species === 'rabbit' ? (
        ([-1, 1] as const).map((side) => (
          <group key={side} position={[side * 0.12, 0.28, -0.02]} rotation={[0.15, 0, side * 0.12]}>
            <mesh castShadow>
              <capsuleGeometry args={[0.06, 0.42, 6, 10]} />
              <meshStandardMaterial color={palette.fur} roughness={0.75} />
            </mesh>
            <mesh position={[0, 0.02, 0.02]} scale={[0.7, 0.92, 0.45]}>
              <capsuleGeometry args={[0.05, 0.36, 5, 8]} />
              <meshStandardMaterial color="#e8b8b0" roughness={0.7} />
            </mesh>
          </group>
        ))
      ) : (
        ([-1, 1] as const).map((side) => (
          <group key={side} position={[side * 0.2, 0.24, -0.02]}>
            <mesh castShadow>
              <sphereGeometry args={[species === 'bear' ? 0.1 : 0.085, 10, 8]} />
              <meshStandardMaterial color={species === 'tiger' ? '#1a1210' : palette.fur} roughness={0.75} />
            </mesh>
            <mesh position={[0, 0, 0.03]} scale={[0.65, 0.65, 0.4]}>
              <sphereGeometry args={[0.08, 8, 6]} />
              <meshStandardMaterial color={species === 'tiger' ? palette.belly : '#e8c4a8'} roughness={0.7} />
            </mesh>
          </group>
        ))
      )}
    </group>
  );
}

function Tail({ species, palette, wag }: { species: FurrySpecies; palette: Palette; wag: number }) {
  if (species === 'tiger') {
    return (
      <group position={[0, 0.85, -0.22]} rotation={[0.6 + wag * 0.15, wag * 0.35, 0]}>
        <mesh castShadow position={[0, 0, -0.35]} rotation={[1.2, 0, 0]}>
          <capsuleGeometry args={[0.07, 0.75, 6, 10]} />
          <meshStandardMaterial color={palette.fur} roughness={0.75} />
        </mesh>
        {palette.stripe && [-0.15, 0.05, 0.25, 0.45].map((z, i) => (
          <StripeBand key={i} color={palette.stripe!} args={[0.16, 0.05, 0.08]} position={[0, -0.02 - i * 0.02, -0.2 - z]} rotation={[1.2, 0, 0]} />
        ))}
        <mesh position={[0, -0.15, -0.85]}>
          <sphereGeometry args={[0.08, 10, 8]} />
          <meshStandardMaterial color={palette.fur} />
        </mesh>
      </group>
    );
  }
  return (
    <group position={[0, 0.88, -0.2]} rotation={[wag * 0.2, wag * 0.4, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[species === 'bear' ? 0.1 : 0.09, 12, 10]} />
        <meshStandardMaterial color={species === 'rabbit' ? palette.belly : palette.fur} roughness={0.9} />
      </mesh>
    </group>
  );
}

function TigerStripes({ color }: { color: string }) {
  return (
    <group>
      <StripeBand color={color} args={[0.08, 0.35, 0.04]} position={[-0.22, 1.15, 0.12]} rotation={[0, 0, 0.3]} />
      <StripeBand color={color} args={[0.08, 0.35, 0.04]} position={[0.22, 1.15, 0.12]} rotation={[0, 0, -0.3]} />
      <StripeBand color={color} args={[0.07, 0.28, 0.04]} position={[-0.18, 0.95, 0.14]} />
      <StripeBand color={color} args={[0.07, 0.28, 0.04]} position={[0.18, 0.95, 0.14]} />
      <StripeBand color={color} args={[0.55, 0.06, 0.04]} position={[0, 1.35, 0.08]} />
      <StripeBand color={color} args={[0.08, 0.4, 0.04]} position={[-0.2, 0.55, 0.1]} />
      <StripeBand color={color} args={[0.08, 0.4, 0.04]} position={[0.2, 0.55, 0.1]} />
      <StripeBand color={color} args={[0.07, 0.32, 0.04]} position={[-0.16, 1.1, -0.16]} />
      <StripeBand color={color} args={[0.07, 0.32, 0.04]} position={[0.16, 1.1, -0.16]} />
    </group>
  );
}

export function FurryStaff({
  species,
  pose = 'idle',
  active = false,
  speedLevel = 1,
  position = [0, 0, 0],
  rotation = 0,
  scale = 1,
}: {
  species: FurrySpecies;
  pose?: FurryPose;
  active?: boolean;
  speedLevel?: number;
  position?: [number, number, number];
  rotation?: number;
  scale?: number;
}) {
  const root = useRef<THREE.Group>(null);
  const hips = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  const palette = PALETTES[species];
  const bustScale = species === 'bear' ? 1.18 : species === 'rabbit' ? 1.05 : 1.0;
  const hipScale = species === 'bear' ? 1.15 : species === 'rabbit' ? 1.08 : 1.05;

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime * (active ? 2.4 + speedLevel * 0.55 : 1.2) + phase;
    const wave = Math.sin(t);
    const wave2 = Math.sin(t * 1.7);
    if (!root.current || !hips.current || !torso.current || !leftArm.current || !rightArm.current || !leftLeg.current || !rightLeg.current) return;

    let y = 0;
    let bodyYaw = 0;
    let bodyPitch = 0;
    let hipRoll = 0;
    let hipPitch = 0;
    let leftArmX = -0.15;
    let rightArmX = -0.15;
    let leftArmZ = 0.08;
    let rightArmZ = -0.08;
    let leftLegX = 0;
    let rightLegX = 0;

    if (pose === 'strip_pole' && active) {
      y = Math.abs(Math.sin(t * 1.4)) * 0.22;
      bodyYaw = t * 0.55;
      hipRoll = wave * 0.35;
      hipPitch = Math.abs(wave) * 0.2;
      leftArmX = -2.2 + wave2 * 0.2;
      rightArmX = -1.9 - wave2 * 0.15;
      leftArmZ = -0.5;
      rightArmZ = 0.35;
      leftLegX = -0.4 + wave * 0.35;
      rightLegX = 0.15 - wave * 0.2;
    } else if (pose === 'strip_floor' && active) {
      y = Math.abs(Math.sin(t * 2)) * 0.08;
      bodyYaw = wave * 0.4;
      hipRoll = wave * 0.45;
      leftArmX = -1.6 + wave * 0.5;
      rightArmX = -1.6 - wave * 0.5;
      leftArmZ = -0.4 + wave2 * 0.2;
      rightArmZ = 0.4 - wave2 * 0.2;
      leftLegX = Math.abs(wave) * 0.5;
      rightLegX = Math.abs(-wave) * 0.5;
    } else if (pose === 'sex_cowgirl' && active) {
      y = 0.55 + Math.abs(Math.sin(t * 2.2)) * 0.12;
      hipPitch = -0.35 + wave * 0.18;
      bodyPitch = 0.15 + wave * 0.08;
      leftArmX = -0.9;
      rightArmX = -0.9;
      leftArmZ = -0.35;
      rightArmZ = 0.35;
      leftLegX = -1.35;
      rightLegX = -1.35;
    } else if (pose === 'sex_missionary' && active) {
      y = 0.35;
      bodyPitch = -1.15 + wave * 0.06;
      hipPitch = 0.25 + wave * 0.12;
      leftArmX = -1.4;
      rightArmX = -1.4;
      leftLegX = -0.85 + wave * 0.08;
      rightLegX = -0.85 - wave * 0.08;
    } else if (pose === 'gangbang_center' && active) {
      y = 0.62 + Math.abs(Math.sin(t * 2.8)) * 0.1;
      hipRoll = wave * 0.28;
      hipPitch = -0.2 + wave2 * 0.15;
      bodyYaw = wave * 0.2;
      leftArmX = -1.55 + wave * 0.35;
      rightArmX = -1.55 - wave * 0.35;
      leftArmZ = -0.55;
      rightArmZ = 0.55;
      leftLegX = -1.1;
      rightLegX = -1.1;
    } else if (pose === 'reclining_guest') {
      y = 0.2;
      bodyPitch = -1.35;
      leftArmX = -0.6;
      rightArmX = -0.4;
      leftLegX = -0.5;
      rightLegX = -0.7;
    } else {
      y = Math.abs(Math.sin(t * 0.8)) * 0.02;
      leftArmX = -0.2 + wave * 0.08;
      rightArmX = -0.2 - wave * 0.08;
      hipRoll = wave * 0.05;
    }

    root.current.position.y = THREE.MathUtils.damp(root.current.position.y, y, 10, delta);
    root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, bodyYaw, pose === 'strip_pole' ? 4 : 8, delta);
    torso.current.rotation.x = THREE.MathUtils.damp(torso.current.rotation.x, bodyPitch, 10, delta);
    hips.current.rotation.z = THREE.MathUtils.damp(hips.current.rotation.z, hipRoll, 10, delta);
    hips.current.rotation.x = THREE.MathUtils.damp(hips.current.rotation.x, hipPitch, 10, delta);
    leftArm.current.rotation.x = THREE.MathUtils.damp(leftArm.current.rotation.x, leftArmX, 12, delta);
    rightArm.current.rotation.x = THREE.MathUtils.damp(rightArm.current.rotation.x, rightArmX, 12, delta);
    leftArm.current.rotation.z = THREE.MathUtils.damp(leftArm.current.rotation.z, leftArmZ, 12, delta);
    rightArm.current.rotation.z = THREE.MathUtils.damp(rightArm.current.rotation.z, rightArmZ, 12, delta);
    leftLeg.current.rotation.x = THREE.MathUtils.damp(leftLeg.current.rotation.x, leftLegX, 12, delta);
    rightLeg.current.rotation.x = THREE.MathUtils.damp(rightLeg.current.rotation.x, rightLegX, 12, delta);
  });

  const wag = active ? Math.sin(phase) : 0;

  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <group ref={root}>
        <group ref={hips}>
          {/* hips / butt */}
          <mesh castShadow position={[0, 0.82, 0]} scale={[hipScale, 0.85, 0.95]}>
            <sphereGeometry args={[0.28, 14, 12]} />
            <meshStandardMaterial color={palette.fur} roughness={0.74} />
          </mesh>
          <mesh castShadow position={[-0.12, 0.8, -0.12]} scale={[1, 0.95, 0.9]}>
            <sphereGeometry args={[0.16, 12, 10]} />
            <meshStandardMaterial color={palette.fur} roughness={0.72} />
          </mesh>
          <mesh castShadow position={[0.12, 0.8, -0.12]} scale={[1, 0.95, 0.9]}>
            <sphereGeometry args={[0.16, 12, 10]} />
            <meshStandardMaterial color={palette.fur} roughness={0.72} />
          </mesh>
          <mesh position={[0, 0.88, 0.05]} scale={[0.7, 0.9, 0.55]}>
            <sphereGeometry args={[0.2, 12, 10]} />
            <meshStandardMaterial color={palette.belly} roughness={0.7} />
          </mesh>
          <Genitals palette={palette} />
          <Genitals palette={palette} rear />
          <Tail species={species} palette={palette} wag={wag} />

          <group ref={leftLeg} position={[-0.14, 0.72, 0]}>
            <mesh castShadow position={[0, -0.22, 0]}>
              <capsuleGeometry args={[0.1, 0.28, 6, 10]} />
              <meshStandardMaterial color={palette.fur} roughness={0.75} />
            </mesh>
            <mesh castShadow position={[0, -0.52, 0.02]}>
              <capsuleGeometry args={[0.09, 0.26, 6, 10]} />
              <meshStandardMaterial color={palette.fur} roughness={0.75} />
            </mesh>
            <group position={[0, -0.78, 0.04]}>
              <PawFoot palette={palette} species={species} />
            </group>
          </group>
          <group ref={rightLeg} position={[0.14, 0.72, 0]}>
            <mesh castShadow position={[0, -0.22, 0]}>
              <capsuleGeometry args={[0.1, 0.28, 6, 10]} />
              <meshStandardMaterial color={palette.fur} roughness={0.75} />
            </mesh>
            <mesh castShadow position={[0, -0.52, 0.02]}>
              <capsuleGeometry args={[0.09, 0.26, 6, 10]} />
              <meshStandardMaterial color={palette.fur} roughness={0.75} />
            </mesh>
            <group position={[0, -0.78, 0.04]}>
              <PawFoot palette={palette} species={species} />
            </group>
          </group>

          <group ref={torso}>
            <mesh castShadow position={[0, 1.12, 0]} scale={[1.05, 1, 0.85]}>
              <capsuleGeometry args={[0.24, 0.38, 6, 12]} />
              <meshStandardMaterial color={palette.fur} roughness={0.72} />
            </mesh>
            <mesh position={[0, 1.05, 0.1]} scale={[0.7, 1.05, 0.45]}>
              <capsuleGeometry args={[0.18, 0.35, 5, 10]} />
              <meshStandardMaterial color={palette.belly} roughness={0.68} />
            </mesh>
            <BreastPair palette={palette} scale={bustScale} />
            {species === 'tiger' && palette.stripe && <TigerStripes color={palette.stripe} />}
            <Head species={species} palette={palette} />

            <group ref={leftArm} position={[-0.34, 1.32, 0]}>
              <mesh castShadow position={[0, -0.22, 0]}>
                <capsuleGeometry args={[0.075, 0.28, 5, 10]} />
                <meshStandardMaterial color={palette.fur} roughness={0.72} />
              </mesh>
              <group position={[0, -0.48, 0]}>
                <PawHand palette={palette} side={-1} />
              </group>
            </group>
            <group ref={rightArm} position={[0.34, 1.32, 0]}>
              <mesh castShadow position={[0, -0.22, 0]}>
                <capsuleGeometry args={[0.075, 0.28, 5, 10]} />
                <meshStandardMaterial color={palette.fur} roughness={0.72} />
              </mesh>
              <group position={[0, -0.48, 0]}>
                <PawHand palette={palette} side={1} />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

/** Simplified male guest used in sex/gangbang scenes. */
export function MaleGuest({
  position,
  rotation = 0,
  active = false,
  pose = 'standing',
  paletteIndex = 0,
}: {
  position: [number, number, number];
  rotation?: number;
  active?: boolean;
  pose?: 'standing' | 'lying' | 'thrusting';
  paletteIndex?: number;
}) {
  const root = useRef<THREE.Group>(null);
  const shirts = ['#3a5a78', '#5a3a48', '#2f4f3f', '#4a3a5a'];
  const shirt = shirts[paletteIndex % shirts.length];
  useFrame(({ clock }) => {
    if (!root.current || !active) return;
    const t = clock.elapsedTime * 2.6 + paletteIndex;
    if (pose === 'thrusting') {
      root.current.position.z = position[2] + Math.sin(t) * 0.06;
      root.current.rotation.x = -0.25 + Math.sin(t) * 0.08;
    } else if (pose === 'lying') {
      root.current.rotation.x = -1.25;
    }
  });
  return (
    <group ref={root} position={position} rotation={[pose === 'lying' ? -1.25 : 0, rotation, 0]} scale={0.92}>
      <mesh castShadow position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.22, 12, 10]} />
        <meshStandardMaterial color="#e0a078" roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0, 1.02, 0]}>
        <capsuleGeometry args={[0.2, 0.4, 5, 10]} />
        <meshStandardMaterial color={shirt} roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0, 0.55, 0]}>
        <capsuleGeometry args={[0.18, 0.25, 5, 10]} />
        <meshStandardMaterial color="#2a3340" roughness={0.8} />
      </mesh>
      {active && pose === 'thrusting' && (
        <mesh position={[0, 0.72, 0.16]} scale={[0.7, 1.1, 0.7]}>
          <capsuleGeometry args={[0.05, 0.16, 4, 8]} />
          <meshStandardMaterial color="#e0a078" roughness={0.65} />
        </mesh>
      )}
    </group>
  );
}

export function RoomActionLabel({ text, position = [0, 2.55, 0] }: { text: string; position?: [number, number, number] }) {
  // World HTML labels are handled in BarScene; this is a 3D placard fallback.
  return (
    <group position={position}>
      <mesh>
        <planeGeometry args={[2.6, 0.42]} />
        <meshBasicMaterial color="#1a0a14" transparent opacity={0.72} depthWrite={false} />
      </mesh>
      {/* Text is shown via HUD/status; placard gives a visible stage marker */}
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[2.45, 0.08]} />
        <meshBasicMaterial color="#ff74bf" transparent opacity={0.85} depthWrite={false} />
      </mesh>
    </group>
  );
}
