import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { CharacterActivity, CharacterPalette, ViewCharacter } from '../view/model';
import { AMBER_PALETTE } from './palette';

export type AmberPoseTargets = {
  bodyY: number;
  bodyX: number;
  bodyZ: number;
  headX: number;
  headY: number;
  headZ: number;
  leftShoulderX: number;
  rightShoulderX: number;
  leftShoulderZ: number;
  rightShoulderZ: number;
  leftElbowX: number;
  rightElbowX: number;
  leftHipX: number;
  rightHipX: number;
  leftKneeX: number;
  rightKneeX: number;
};

const idlePose = (phase: number): AmberPoseTargets => ({
  bodyY: Math.sin(phase * 0.55) * 0.012,
  bodyX: 0,
  bodyZ: Math.sin(phase * 0.42) * 0.012,
  headX: Math.sin(phase * 0.38) * 0.025,
  headY: Math.sin(phase * 0.24) * 0.07,
  headZ: 0,
  leftShoulderX: -0.08 + Math.sin(phase * 0.6) * 0.025,
  rightShoulderX: -0.08 - Math.sin(phase * 0.6) * 0.025,
  leftShoulderZ: 0.04,
  rightShoulderZ: -0.04,
  leftElbowX: -0.05,
  rightElbowX: -0.05,
  leftHipX: 0,
  rightHipX: 0,
  leftKneeX: 0.03,
  rightKneeX: 0.03,
});

export function getPoseTargets(activity: CharacterActivity, phase: number, progress = 0): AmberPoseTargets {
  const base = idlePose(phase);
  const wave = Math.sin(phase);
  const fast = Math.sin(phase * 2.15);
  const easedProgress = THREE.MathUtils.smootherstep(Math.max(0, Math.min(1, progress)), 0, 1);

  if (activity === 'walk') {
    const stride = wave * 0.72;
    return {
      ...base,
      bodyY: Math.abs(Math.sin(phase * 2)) * 0.055,
      bodyX: 0.045,
      bodyZ: wave * 0.035,
      headZ: -wave * 0.025,
      leftShoulderX: stride,
      rightShoulderX: -stride,
      leftHipX: -stride * 0.86,
      rightHipX: stride * 0.86,
      leftKneeX: Math.max(0, wave) * 0.55,
      rightKneeX: Math.max(0, -wave) * 0.55,
    };
  }

  if (activity === 'order') {
    return {
      ...base,
      bodyX: -0.06,
      headX: 0.08 + Math.sin(phase * 0.75) * 0.04,
      leftShoulderX: -0.92,
      rightShoulderX: -1.08 + fast * 0.13,
      leftElbowX: -0.62,
      rightElbowX: -0.92,
      rightShoulderZ: -0.16,
    };
  }

  if (activity === 'drink') {
    const sip = 0.5 + 0.5 * Math.sin(phase * 0.58 - Math.PI / 2);
    return {
      ...base,
      headX: -0.08 * sip,
      rightShoulderX: THREE.MathUtils.lerp(-0.52, -1.42, sip),
      rightElbowX: THREE.MathUtils.lerp(-0.34, -1.14, sip),
      rightShoulderZ: -0.12 * sip,
      leftShoulderX: -0.38,
    };
  }

  if (activity === 'pay') {
    return {
      ...base,
      bodyX: -0.045,
      headX: 0.04,
      rightShoulderX: -1.24 + easedProgress * 0.12,
      rightElbowX: -0.74,
      rightShoulderZ: -0.2,
      leftShoulderX: -0.42,
    };
  }

  if (activity === 'karaoke') {
    return {
      ...base,
      bodyY: Math.abs(fast) * 0.075,
      bodyZ: wave * 0.12,
      headX: Math.sin(phase * 1.35) * 0.11,
      headY: Math.sin(phase * 0.42) * 0.18,
      leftShoulderX: -1.5 + wave * 0.24,
      rightShoulderX: -0.82 + fast * 0.26,
      leftShoulderZ: -0.3,
      rightShoulderZ: 0.12,
      leftElbowX: -0.45,
      rightElbowX: -0.94,
      leftHipX: wave * 0.16,
      rightHipX: -wave * 0.16,
      leftKneeX: Math.max(0, fast) * 0.24,
      rightKneeX: Math.max(0, -fast) * 0.24,
    };
  }

  if (activity === 'sauna') {
    return {
      ...base,
      rightShoulderX: -1.36 + fast * 0.18,
      rightElbowX: -0.92,
      leftShoulderX: -0.48,
      bodyZ: wave * 0.035,
    };
  }

  if (activity === 'massage') {
    return {
      ...base,
      bodyX: -0.16,
      leftShoulderX: -1.12 + fast * 0.22,
      rightShoulderX: -1.12 - fast * 0.22,
      leftElbowX: -0.64,
      rightElbowX: -0.64,
      leftShoulderZ: -0.12,
      rightShoulderZ: 0.12,
    };
  }

  if (activity === 'serve') {
    return {
      ...base,
      leftShoulderX: -0.82,
      rightShoulderX: -0.82,
      leftElbowX: -0.52,
      rightElbowX: -0.52,
      bodyX: -0.04,
    };
  }

  if (activity === 'clean') {
    return {
      ...base,
      bodyX: -0.12,
      leftShoulderX: -1.08 + fast * 0.28,
      rightShoulderX: -1.08 - fast * 0.28,
      leftElbowX: -0.5,
      rightElbowX: -0.5,
      bodyZ: fast * 0.035,
    };
  }

  return base;
}

const PALETTES: CharacterPalette[] = [
  { skin: '#e2a177', hair: '#392821', primary: AMBER_PALETTE.terracotta, secondary: AMBER_PALETTE.spruce },
  { skin: '#f0bd94', hair: '#8f4b2d', primary: AMBER_PALETTE.teal, secondary: '#5b477a' },
  { skin: '#9d6249', hair: '#242326', primary: AMBER_PALETTE.honey, secondary: '#285562' },
  { skin: '#c78361', hair: '#5a3526', primary: AMBER_PALETTE.karaokeHot, secondary: AMBER_PALETTE.spruce },
  { skin: '#f0c7a5', hair: '#2d3540', primary: AMBER_PALETTE.massage, secondary: '#4a3e54' },
];

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) | 0;
  return Math.abs(hash);
};

const dampRotation = (group: THREE.Object3D | null, axis: 'x' | 'y' | 'z', value: number, delta: number, speed = 11) => {
  if (!group) return;
  group.rotation[axis] = THREE.MathUtils.damp(group.rotation[axis], value, speed, delta);
};

function DrinkGlass() {
  return (
    <group>
      <mesh castShadow><cylinderGeometry args={[0.12, 0.1, 0.34, 14]} /><meshPhysicalMaterial color="#d8f3ef" roughness={0.12} transmission={0.35} transparent opacity={0.7} /></mesh>
      <mesh position={[0, 0.01, 0]}><cylinderGeometry args={[0.094, 0.078, 0.27, 14]} /><meshStandardMaterial color={AMBER_PALETTE.honey} roughness={0.3} /></mesh>
      <mesh position={[0, 0.18, 0]}><cylinderGeometry args={[0.104, 0.104, 0.055, 14]} /><meshStandardMaterial color={AMBER_PALETTE.cream} roughness={0.85} /></mesh>
      <mesh position={[0.13, 0, 0]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.09, 0.018, 7, 14, Math.PI * 1.7]} /><meshStandardMaterial color="#d8f3ef" roughness={0.18} /></mesh>
    </group>
  );
}

function CharacterProp({ character }: { character: ViewCharacter }) {
  if (character.activity === 'drink') {
    return <group position={[0.46, 1.16, 0.34]} rotation={[0, 0, -0.18]}><DrinkGlass /></group>;
  }
  if (character.activity === 'pay') {
    return (
      <group position={[0.48, 1.05, 0.45]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh><cylinderGeometry args={[0.11, 0.11, 0.035, 16]} /><meshStandardMaterial color={AMBER_PALETTE.honey} metalness={0.72} roughness={0.24} /></mesh>
        <mesh position={[0, 0.02, 0]}><torusGeometry args={[0.065, 0.012, 6, 16]} /><meshStandardMaterial color={AMBER_PALETTE.honeyLight} metalness={0.55} roughness={0.25} /></mesh>
      </group>
    );
  }
  if (character.activity === 'order') {
    return (
      <group position={[0, 1.02, 0.43]} rotation={[-0.13, 0, 0]}>
        <RoundedBox args={[0.48, 0.62, 0.055]} radius={0.04} smoothness={2}><meshStandardMaterial color={AMBER_PALETTE.cream} roughness={0.9} /></RoundedBox>
        {[-0.15, 0, 0.15].map((y) => <mesh key={y} position={[-0.04, y, 0.035]}><boxGeometry args={[0.26, 0.025, 0.012]} /><meshBasicMaterial color={AMBER_PALETTE.teal} /></mesh>)}
      </group>
    );
  }
  if (character.activity === 'karaoke' || character.role === 'karaoke-host') {
    return (
      <group position={[0.46, 1.12, 0.34]} rotation={[0.12, 0, -0.22]}>
        <mesh><cylinderGeometry args={[0.035, 0.035, 0.42, 10]} /><meshStandardMaterial color={AMBER_PALETTE.charcoal} metalness={0.48} roughness={0.28} /></mesh>
        <mesh position={[0, 0.24, 0]}><sphereGeometry args={[0.095, 12, 8]} /><meshStandardMaterial color="#141719" metalness={0.38} roughness={0.32} /></mesh>
      </group>
    );
  }
  if (character.activity === 'sauna' || character.role === 'sauna-attendant') {
    return (
      <group position={[0.43, 1.03, 0.3]} rotation={[0.1, 0, -0.28]}>
        <mesh><cylinderGeometry args={[0.025, 0.025, 0.55, 8]} /><meshStandardMaterial color={AMBER_PALETTE.oak} roughness={0.75} /></mesh>
        <mesh position={[0, -0.31, 0]}><sphereGeometry args={[0.13, 10, 7]} /><meshStandardMaterial color={AMBER_PALETTE.oak} roughness={0.78} /></mesh>
      </group>
    );
  }
  if (character.activity === 'serve') {
    return (
      <group position={[0, 0.96, 0.43]}>
        <mesh><cylinderGeometry args={[0.42, 0.42, 0.045, 20]} /><meshStandardMaterial color={AMBER_PALETTE.brass} metalness={0.62} roughness={0.26} /></mesh>
        <group position={[-0.12, 0.19, 0]} scale={0.75}><DrinkGlass /></group>
      </group>
    );
  }
  return null;
}

export type AmberCharacterProps = {
  character: ViewCharacter;
  reducedMotion?: boolean;
};

export function AmberCharacter({ character, reducedMotion = false }: AmberCharacterProps) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const chest = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const leftShoulder = useRef<THREE.Group>(null);
  const rightShoulder = useRef<THREE.Group>(null);
  const leftElbow = useRef<THREE.Group>(null);
  const rightElbow = useRef<THREE.Group>(null);
  const leftHip = useRef<THREE.Group>(null);
  const rightHip = useRef<THREE.Group>(null);
  const leftKnee = useRef<THREE.Group>(null);
  const rightKnee = useRef<THREE.Group>(null);
  const leftEye = useRef<THREE.Mesh>(null);
  const rightEye = useRef<THREE.Mesh>(null);
  const phase = useRef((hashString(character.id) % 628) / 100);
  const basePalette = PALETTES[hashString(character.id) % PALETTES.length];
  const colors = useMemo<CharacterPalette>(() => ({ ...basePalette, ...character.palette }), [basePalette, character.palette]);
  const desiredPosition = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }, delta) => {
    if (!root.current) return;
    phase.current += delta * (reducedMotion ? 0.35 : character.activity === 'walk' ? 7.4 : character.activity === 'karaoke' ? 5.4 : 2.8);
    const pose = getPoseTargets(character.activity, phase.current, character.activityProgress ?? 0);
    desiredPosition.set(character.position.x, character.seated ? 0.02 : 0.04, character.position.z);
    root.current.position.lerp(desiredPosition, 1 - Math.exp(-delta * 12));

    const target = character.target ?? character.position;
    const dx = target.x - character.position.x;
    const dz = target.z - character.position.z;
    if (Math.hypot(dx, dz) > 0.025) {
      const desiredYaw = Math.atan2(dx, dz);
      const yawDelta = THREE.MathUtils.euclideanModulo(desiredYaw - root.current.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
      root.current.rotation.y += yawDelta * Math.min(1, delta * 8.5);
    }

    if (body.current) {
      body.current.position.y = THREE.MathUtils.damp(body.current.position.y, pose.bodyY, 12, delta);
      dampRotation(body.current, 'x', pose.bodyX, delta, 10);
      dampRotation(body.current, 'z', pose.bodyZ, delta, 10);
    }
    if (chest.current) {
      const breath = 1 + Math.sin(phase.current * 0.58) * (reducedMotion ? 0.002 : 0.009);
      chest.current.scale.set(1 / Math.sqrt(breath), breath, 1 / Math.sqrt(breath));
    }
    dampRotation(head.current, 'x', pose.headX, delta, 9);
    dampRotation(head.current, 'y', pose.headY, delta, 9);
    dampRotation(head.current, 'z', pose.headZ, delta, 9);
    dampRotation(leftShoulder.current, 'x', pose.leftShoulderX, delta);
    dampRotation(rightShoulder.current, 'x', pose.rightShoulderX, delta);
    dampRotation(leftShoulder.current, 'z', pose.leftShoulderZ, delta);
    dampRotation(rightShoulder.current, 'z', pose.rightShoulderZ, delta);
    dampRotation(leftElbow.current, 'x', pose.leftElbowX, delta, 13);
    dampRotation(rightElbow.current, 'x', pose.rightElbowX, delta, 13);
    dampRotation(leftHip.current, 'x', character.seated ? -1.12 : pose.leftHipX, delta, 13);
    dampRotation(rightHip.current, 'x', character.seated ? -1.12 : pose.rightHipX, delta, 13);
    dampRotation(leftKnee.current, 'x', character.seated ? 1.12 : pose.leftKneeX, delta, 14);
    dampRotation(rightKnee.current, 'x', character.seated ? 1.12 : pose.rightKneeX, delta, 14);

    const blinkPeriod = 3.1 + (hashString(character.id) % 9) * 0.11;
    const blinkPhase = (clock.elapsedTime + phase.current * 0.17) % blinkPeriod;
    const blink = blinkPhase < 0.13 ? Math.max(0.08, Math.abs(blinkPhase - 0.065) / 0.065) : 1;
    if (leftEye.current) leftEye.current.scale.y = THREE.MathUtils.damp(leftEye.current.scale.y, blink, 34, delta);
    if (rightEye.current) rightEye.current.scale.y = THREE.MathUtils.damp(rightEye.current.scale.y, blink, 34, delta);
  });

  const isStaff = character.role !== 'patron';
  const shirt = character.role === 'bartender' ? AMBER_PALETTE.cream : colors.primary;
  const trousers = isStaff ? AMBER_PALETTE.spruce : colors.secondary;

  return (
    <group
      ref={root}
      name={`amber-character-${character.id}`}
      position={[character.position.x, character.seated ? 0.02 : 0.04, character.position.z]}
      scale={character.role === 'patron' ? 0.92 : 0.98}
      visible={character.visible !== false}
    >
      <group ref={body}>
        <group ref={chest} position={[0, 1.08, 0]}>
          <RoundedBox args={[0.68, 0.78, 0.44]} radius={0.16} smoothness={3} castShadow>
            <meshStandardMaterial color={shirt} roughness={0.72} />
          </RoundedBox>
          {isStaff && (
            <RoundedBox args={[0.48, 0.54, 0.025]} radius={0.04} smoothness={2} position={[0, -0.03, 0.23]}>
              <meshStandardMaterial color={character.role === 'karaoke-host' ? AMBER_PALETTE.karaoke : character.role === 'sauna-attendant' ? AMBER_PALETTE.sauna : character.role === 'massage-therapist' ? AMBER_PALETTE.massage : AMBER_PALETTE.spruce} roughness={0.78} />
            </RoundedBox>
          )}
        </group>

        <group ref={head} position={[0, 1.72, 0]}>
          <mesh castShadow><sphereGeometry args={[0.33, 18, 14]} /><meshStandardMaterial color={colors.skin} roughness={0.68} /></mesh>
          <mesh castShadow position={[0, 0.17, -0.035]} scale={[1.04, 0.58, 1.02]}><sphereGeometry args={[0.33, 17, 11]} /><meshStandardMaterial color={colors.hair} roughness={0.9} /></mesh>
          <mesh ref={leftEye} position={[-0.115, 0.025, 0.307]}><sphereGeometry args={[0.039, 9, 8]} /><meshStandardMaterial color={AMBER_PALETTE.spruceDeep} roughness={0.45} /></mesh>
          <mesh ref={rightEye} position={[0.115, 0.025, 0.307]}><sphereGeometry args={[0.039, 9, 8]} /><meshStandardMaterial color={AMBER_PALETTE.spruceDeep} roughness={0.45} /></mesh>
          <mesh position={[0, -0.145, 0.315]} rotation={[0, 0, character.mood === 'impatient' ? Math.PI : 0]}>
            <torusGeometry args={[0.075, 0.012, 6, 14, Math.PI]} />
            <meshStandardMaterial color="#944d4d" roughness={0.7} />
          </mesh>
          {character.mood === 'delighted' && <mesh position={[0, 0.42, 0]}><octahedronGeometry args={[0.09, 0]} /><meshStandardMaterial color={AMBER_PALETTE.honey} emissive={AMBER_PALETTE.honey} emissiveIntensity={0.45} /></mesh>}
        </group>

        <group ref={leftShoulder} position={[-0.43, 1.34, 0]}>
          <mesh castShadow position={[0, -0.25, 0]}><capsuleGeometry args={[0.095, 0.36, 6, 10]} /><meshStandardMaterial color={shirt} roughness={0.72} /></mesh>
          <group ref={leftElbow} position={[0, -0.48, 0]}>
            <mesh castShadow position={[0, -0.22, 0]}><capsuleGeometry args={[0.082, 0.29, 6, 10]} /><meshStandardMaterial color={colors.skin} roughness={0.67} /></mesh>
          </group>
        </group>
        <group ref={rightShoulder} position={[0.43, 1.34, 0]}>
          <mesh castShadow position={[0, -0.25, 0]}><capsuleGeometry args={[0.095, 0.36, 6, 10]} /><meshStandardMaterial color={shirt} roughness={0.72} /></mesh>
          <group ref={rightElbow} position={[0, -0.48, 0]}>
            <mesh castShadow position={[0, -0.22, 0]}><capsuleGeometry args={[0.082, 0.29, 6, 10]} /><meshStandardMaterial color={colors.skin} roughness={0.67} /></mesh>
          </group>
        </group>

        <group ref={leftHip} position={[-0.2, 0.75, 0]}>
          <mesh castShadow position={[0, -0.23, 0]}><capsuleGeometry args={[0.11, 0.35, 6, 10]} /><meshStandardMaterial color={trousers} roughness={0.82} /></mesh>
          <group ref={leftKnee} position={[0, -0.47, 0]}>
            <mesh castShadow position={[0, -0.22, 0]}><capsuleGeometry args={[0.095, 0.32, 6, 10]} /><meshStandardMaterial color={trousers} roughness={0.84} /></mesh>
            <RoundedBox args={[0.22, 0.14, 0.38]} radius={0.07} smoothness={2} position={[0, -0.46, 0.1]} castShadow><meshStandardMaterial color={AMBER_PALETTE.charcoal} roughness={0.9} /></RoundedBox>
          </group>
        </group>
        <group ref={rightHip} position={[0.2, 0.75, 0]}>
          <mesh castShadow position={[0, -0.23, 0]}><capsuleGeometry args={[0.11, 0.35, 6, 10]} /><meshStandardMaterial color={trousers} roughness={0.82} /></mesh>
          <group ref={rightKnee} position={[0, -0.47, 0]}>
            <mesh castShadow position={[0, -0.22, 0]}><capsuleGeometry args={[0.095, 0.32, 6, 10]} /><meshStandardMaterial color={trousers} roughness={0.84} /></mesh>
            <RoundedBox args={[0.22, 0.14, 0.38]} radius={0.07} smoothness={2} position={[0, -0.46, 0.1]} castShadow><meshStandardMaterial color={AMBER_PALETTE.charcoal} roughness={0.9} /></RoundedBox>
          </group>
        </group>

        <CharacterProp character={character} />
      </group>
    </group>
  );
}
