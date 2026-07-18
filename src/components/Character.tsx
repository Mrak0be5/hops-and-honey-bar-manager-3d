import { RoundedBox, Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Bartender, Patron, PatronState, Vec2 } from '../game/types';

export const CUSTOMER_EMOJI: Record<PatronState, { emoji: string; label: string }> = {
  walking_in: { emoji: '🚪', label: 'Ищет столик' },
  waiting_order: { emoji: '🙋', label: 'Ждёт бармена' },
  ordering: { emoji: '📝', label: 'Делает заказ' },
  waiting_drink: { emoji: '⏳', label: 'Ждёт напиток' },
  drinking: { emoji: '🍺', label: 'Пьёт заказ' },
  ready_to_pay: { emoji: '💰', label: 'Хочет заплатить' },
  paying: { emoji: '🤝', label: 'Платит' },
  leaving: { emoji: '😊', label: 'Уходит счастливым' },
};

export const BARTENDER_EMOJI: Record<Bartender['state'], { emoji: string; label: string }> = {
  idle: { emoji: '👀', label: 'Ищет задачу' },
  to_order: { emoji: '🏃', label: 'Идёт к гостю' },
  taking_order: { emoji: '📝', label: 'Принимает заказ' },
  to_bar: { emoji: '🏃', label: 'Идёт к стойке' },
  preparing: { emoji: '🍺', label: 'Готовит напиток' },
  to_deliver: { emoji: '🍻', label: 'Несёт заказ' },
  delivering: { emoji: '🤝', label: 'Подаёт напиток' },
  to_payment: { emoji: '🏃', label: 'Идёт за оплатой' },
  taking_payment: { emoji: '💰', label: 'Принимает оплату' },
  to_cleanup: { emoji: '🧽', label: 'Идёт убирать' },
  cleaning: { emoji: '✨', label: 'Убирает стол' },
  returning_dirty: { emoji: '🫧', label: 'Несёт кружки на мойку' },
};

const PALETTES = [
  { shirt: '#ef5b52', trousers: '#174d57', hair: '#38251f', skin: '#f1b28b' },
  { shirt: '#16a6a2', trousers: '#4b335d', hair: '#d4542d', skin: '#f3c39e' },
  { shirt: '#f4b63f', trousers: '#1d5665', hair: '#202735', skin: '#9d5d42' },
  { shirt: '#da4575', trousers: '#1c4151', hair: '#f09b32', skin: '#e7a477' },
  { shirt: '#5f76df', trousers: '#523c3b', hair: '#55311f', skin: '#c17b57' },
  { shirt: '#69b848', trousers: '#313754', hair: '#292423', skin: '#f0c1a0' },
];

export function BeerMug({ color = '#e9a62f', dirty = false, scale = 1 }: { color?: string; dirty?: boolean; scale?: number }) {
  return (
    <group scale={scale}>
      <mesh castShadow position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.12, 0.1, 0.3, 12]} />
        <meshPhysicalMaterial color={dirty ? '#c7c1ae' : '#d9f5f2'} roughness={0.16} transmission={dirty ? 0 : 0.24} thickness={0.08} transparent opacity={dirty ? 0.82 : 0.58} />
      </mesh>
      {!dirty && (
        <mesh position={[0, 0.125, 0]}>
          <cylinderGeometry args={[0.096, 0.082, 0.245, 12]} />
          <meshStandardMaterial color={color} roughness={0.28} transparent opacity={0.92} />
        </mesh>
      )}
      {!dirty && (
        <group position={[0, 0.295, 0]}>
          <mesh>
            <cylinderGeometry args={[0.108, 0.108, 0.055, 14]} />
            <meshStandardMaterial color="#fff4cf" roughness={0.82} />
          </mesh>
          {[[-0.045, 0.01], [0.035, -0.025], [0.012, 0.04]].map(([x, z], index) => (
            <mesh key={index} position={[x, 0.038 + index * 0.006, z]}>
              <sphereGeometry args={[0.035 - index * 0.004, 8, 6]} />
              <meshStandardMaterial color="#fff9dc" roughness={0.78} />
            </mesh>
          ))}
        </group>
      )}
      <mesh position={[0, 0.29, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.11, 0.012, 7, 16]} />
        <meshStandardMaterial color={dirty ? '#aaa797' : '#e9ffff'} metalness={0.08} roughness={0.25} />
      </mesh>
      <mesh position={[0.13, 0.15, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.09, 0.025, 7, 12, Math.PI * 1.65]} />
        <meshStandardMaterial color={dirty ? '#b7b4a5' : '#d8eef0'} roughness={0.35} />
      </mesh>
    </group>
  );
}

type HumanoidProps = {
  position: Vec2;
  target: Vec2;
  palette: number;
  moving: boolean;
  seated?: boolean;
  drinking?: boolean;
  bartender?: boolean;
  carryingDrink?: string | null;
  carryingDirty?: boolean;
  activity: PatronState | Bartender['state'];
};

function Humanoid({ position, target, palette, moving, seated = false, drinking = false, bartender = false, carryingDrink, carryingDirty, activity }: HumanoidProps) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftKnee = useRef<THREE.Group>(null);
  const rightKnee = useRef<THREE.Group>(null);
  const mug = useRef<THREE.Group>(null);
  const phase = useRef(Math.random() * Math.PI * 2);
  const colors = bartender
    ? { shirt: '#f5efe3', trousers: '#173d47', hair: '#3c2a22', skin: '#d9956c' }
    : PALETTES[palette % PALETTES.length];
  const desired = useMemo(() => new THREE.Vector3(), []);
  const mugDesired = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    if (!root.current) return;
    phase.current += delta * (moving ? 8.5 : 2.2);
    const wave = Math.sin(phase.current);
    const fastWave = Math.sin(phase.current * 2.4);
    const walkBob = moving && !seated ? Math.abs(Math.sin(phase.current * 2)) * 0.045 : 0;
    desired.set(position.x, (seated ? 0.015 : 0.05) + walkBob, position.z);
    root.current.position.lerp(desired, 1 - Math.exp(-delta * 12));

    const dx = target.x - position.x;
    const dz = target.z - position.z;
    if (Math.hypot(dx, dz) > 0.02) {
      const desiredRotation = Math.atan2(dx, dz);
      const deltaRotation = THREE.MathUtils.euclideanModulo(desiredRotation - root.current.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
      root.current.rotation.y += deltaRotation * Math.min(1, delta * (moving ? 8 : 5.5));
    }

    const stride = moving ? wave * 0.68 : 0;
    let leftArmX = moving ? stride : -0.04 + wave * 0.025;
    let rightArmX = moving ? -stride : -0.04 - wave * 0.025;
    let leftArmZ = 0.02;
    let rightArmZ = -0.02;

    if (activity === 'waiting_order') {
      leftArmX = -0.95 + fastWave * 0.16;
      leftArmZ = -0.24 + fastWave * 0.08;
    } else if (activity === 'ordering' || activity === 'taking_order') {
      leftArmX = -0.74 + fastWave * 0.08;
      rightArmX = -0.92 - fastWave * 0.1;
    } else if (drinking) {
      leftArmX = -0.38;
      rightArmX = -1.42 + fastWave * 0.04;
      rightArmZ = -0.11;
    } else if (activity === 'ready_to_pay') {
      leftArmX = -1.22 + fastWave * 0.12;
      leftArmZ = -0.28;
    } else if (activity === 'paying' || activity === 'taking_payment') {
      rightArmX = -1.05;
      leftArmX = -0.54;
    } else if (activity === 'preparing') {
      leftArmX = -1.05 + fastWave * 0.28;
      rightArmX = -1.18 - fastWave * 0.22;
    } else if (activity === 'delivering') {
      leftArmX = -0.68;
      rightArmX = -0.92;
    } else if (activity === 'cleaning') {
      leftArmX = -1.02 + fastWave * 0.3;
      rightArmX = -1.02 - fastWave * 0.3;
    } else if (carryingDrink || carryingDirty) {
      rightArmX = -0.58;
      leftArmX = -0.25;
    }

    if (leftArm.current) {
      leftArm.current.rotation.x = THREE.MathUtils.damp(leftArm.current.rotation.x, leftArmX, 12, delta);
      leftArm.current.rotation.z = THREE.MathUtils.damp(leftArm.current.rotation.z, leftArmZ, 12, delta);
    }
    if (rightArm.current) {
      rightArm.current.rotation.x = THREE.MathUtils.damp(rightArm.current.rotation.x, rightArmX, 12, delta);
      rightArm.current.rotation.z = THREE.MathUtils.damp(rightArm.current.rotation.z, rightArmZ, 12, delta);
    }

    const leftHip = seated ? -1.14 : -stride;
    const rightHip = seated ? -1.14 : stride;
    const leftKneeBend = seated ? 1.14 : Math.max(0, wave) * 0.48;
    const rightKneeBend = seated ? 1.14 : Math.max(0, -wave) * 0.48;
    if (leftLeg.current) leftLeg.current.rotation.x = THREE.MathUtils.damp(leftLeg.current.rotation.x, leftHip, 14, delta);
    if (rightLeg.current) rightLeg.current.rotation.x = THREE.MathUtils.damp(rightLeg.current.rotation.x, rightHip, 14, delta);
    if (leftKnee.current) leftKnee.current.rotation.x = THREE.MathUtils.damp(leftKnee.current.rotation.x, leftKneeBend, 14, delta);
    if (rightKnee.current) rightKnee.current.rotation.x = THREE.MathUtils.damp(rightKnee.current.rotation.x, rightKneeBend, 14, delta);

    if (body.current) {
      const actionLean = activity === 'preparing' || activity === 'cleaning' ? -0.08 : moving ? 0.045 : 0;
      body.current.rotation.x = THREE.MathUtils.damp(body.current.rotation.x, actionLean, 9, delta);
      const breath = 1 + Math.sin(phase.current * 0.72) * 0.008;
      body.current.scale.set(1 / Math.sqrt(breath), breath, 1 / Math.sqrt(breath));
    }
    if (head.current) {
      const look = seated && !drinking ? Math.sin(phase.current * 0.48) * 0.08 : 0;
      head.current.rotation.y = THREE.MathUtils.damp(head.current.rotation.y, look, 7, delta);
      head.current.rotation.x = THREE.MathUtils.damp(head.current.rotation.x, drinking ? -0.09 : 0, 8, delta);
    }
    if (mug.current) {
      const mugY = drinking ? 1.31 + Math.sin(phase.current * 1.4) * 0.025 : 0.84;
      mugDesired.set(0.48, mugY, drinking ? 0.34 : 0.28);
      mug.current.position.lerp(mugDesired, 1 - Math.exp(-delta * 14));
      mug.current.rotation.z = THREE.MathUtils.damp(mug.current.rotation.z, drinking ? -0.25 : 0, 12, delta);
    }
  });

  return (
    <group ref={root} name={bartender ? 'bartender-character' : 'patron-character'} position={[position.x, seated ? 0.015 : 0.05, position.z]}>
      <group ref={body}>
        <group ref={head} position={[0, 1.62, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.31, 18, 14]} />
            <meshStandardMaterial color={colors.skin} roughness={0.65} />
          </mesh>
          <mesh castShadow position={[0, 0.14, -0.03]} scale={[1.03, 0.57, 1.02]}>
            <sphereGeometry args={[0.31, 16, 10]} />
            <meshStandardMaterial color={colors.hair} roughness={0.9} />
          </mesh>
          <mesh position={[-0.11, 0.02, 0.285]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color="#152e39" />
          </mesh>
          <mesh position={[0.11, 0.02, 0.285]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color="#152e39" />
          </mesh>
          <mesh position={[-0.31, -0.02, 0]} scale={[0.45, 0.6, 0.38]}>
            <sphereGeometry args={[0.16, 10, 8]} />
            <meshStandardMaterial color={colors.skin} roughness={0.7} />
          </mesh>
          <mesh position={[0.31, -0.02, 0]} scale={[0.45, 0.6, 0.38]}>
            <sphereGeometry args={[0.16, 10, 8]} />
            <meshStandardMaterial color={colors.skin} roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.055, 0.304]} scale={[0.42, 0.5, 0.38]}>
            <sphereGeometry args={[0.11, 9, 7]} />
            <meshStandardMaterial color={colors.skin} roughness={0.68} />
          </mesh>
          <mesh position={[0, -0.155, 0.306]}>
            <boxGeometry args={[0.13, 0.024, 0.018]} />
            <meshStandardMaterial color="#93484b" roughness={0.72} />
          </mesh>
          <mesh position={[-0.11, 0.105, 0.298]} rotation={[0, 0, 0.08]}>
            <boxGeometry args={[0.11, 0.025, 0.018]} />
            <meshStandardMaterial color={colors.hair} roughness={0.82} />
          </mesh>
          <mesh position={[0.11, 0.105, 0.298]} rotation={[0, 0, -0.08]}>
            <boxGeometry args={[0.11, 0.025, 0.018]} />
            <meshStandardMaterial color={colors.hair} roughness={0.82} />
          </mesh>
          {bartender && (
            <mesh position={[0, 0.28, -0.02]} rotation={[0.08, 0, 0]}>
              <cylinderGeometry args={[0.28, 0.33, 0.12, 16]} />
              <meshStandardMaterial color="#0e7e7d" roughness={0.6} />
            </mesh>
          )}
        </group>

        <RoundedBox args={[0.62, 0.78, 0.36]} radius={0.16} smoothness={3} position={[0, 1.03, 0]} castShadow>
          <meshStandardMaterial color={colors.shirt} roughness={0.72} />
        </RoundedBox>
        <mesh position={[-0.1, 1.34, 0.2]} rotation={[0, 0, 0.58]}>
          <boxGeometry args={[0.2, 0.08, 0.035]} />
          <meshStandardMaterial color="#fff1cf" roughness={0.74} />
        </mesh>
        <mesh position={[0.1, 1.34, 0.2]} rotation={[0, 0, -0.58]}>
          <boxGeometry args={[0.2, 0.08, 0.035]} />
          <meshStandardMaterial color="#fff1cf" roughness={0.74} />
        </mesh>
        {bartender && (
          <group>
            <RoundedBox args={[0.48, 0.52, 0.08]} radius={0.08} smoothness={3} position={[0, 0.91, 0.22]}>
              <meshStandardMaterial color="#ef663e" roughness={0.68} />
            </RoundedBox>
            <mesh position={[0, 1.18, 0.23]}>
              <boxGeometry args={[0.07, 0.1, 0.035]} />
              <meshStandardMaterial color="#ffeab8" />
            </mesh>
            <mesh position={[0, 0.76, 0.265]}>
              <boxGeometry args={[0.25, 0.13, 0.025]} />
              <meshStandardMaterial color="#ffd784" roughness={0.64} />
            </mesh>
          </group>
        )}

        <group ref={leftArm} position={[-0.39, 1.28, 0]}>
          <mesh castShadow position={[0, -0.3, 0]}>
            <capsuleGeometry args={[0.1, 0.44, 6, 10]} />
            <meshStandardMaterial color={colors.shirt} roughness={0.7} />
          </mesh>
          <mesh castShadow position={[0, -0.59, 0]}>
            <sphereGeometry args={[0.105, 10, 8]} />
            <meshStandardMaterial color={colors.skin} roughness={0.68} />
          </mesh>
        </group>
        <group ref={rightArm} position={[0.39, 1.28, 0]}>
          <mesh castShadow position={[0, -0.3, 0]}>
            <capsuleGeometry args={[0.1, 0.44, 6, 10]} />
            <meshStandardMaterial color={colors.shirt} roughness={0.7} />
          </mesh>
          <mesh castShadow position={[0, -0.59, 0]}>
            <sphereGeometry args={[0.105, 10, 8]} />
            <meshStandardMaterial color={colors.skin} roughness={0.68} />
          </mesh>
        </group>

        <group ref={leftLeg} position={[-0.19, 0.67, 0]}>
          <mesh castShadow position={[0, -0.2, 0]}>
            <capsuleGeometry args={[0.12, 0.22, 6, 10]} />
            <meshStandardMaterial color={colors.trousers} roughness={0.8} />
          </mesh>
          <group ref={leftKnee} position={[0, -0.42, 0]}>
            <mesh castShadow position={[0, -0.23, 0]}>
              <capsuleGeometry args={[0.105, 0.25, 6, 10]} />
              <meshStandardMaterial color={colors.trousers} roughness={0.82} />
            </mesh>
            <mesh castShadow position={[0, -0.49, 0.09]} scale={[1, 0.7, 1.5]}>
              <sphereGeometry args={[0.14, 10, 8]} />
              <meshStandardMaterial color="#25313a" roughness={0.9} />
            </mesh>
          </group>
        </group>
        <group ref={rightLeg} position={[0.19, 0.67, 0]}>
          <mesh castShadow position={[0, -0.2, 0]}>
            <capsuleGeometry args={[0.12, 0.22, 6, 10]} />
            <meshStandardMaterial color={colors.trousers} roughness={0.8} />
          </mesh>
          <group ref={rightKnee} position={[0, -0.42, 0]}>
            <mesh castShadow position={[0, -0.23, 0]}>
              <capsuleGeometry args={[0.105, 0.25, 6, 10]} />
              <meshStandardMaterial color={colors.trousers} roughness={0.82} />
            </mesh>
            <mesh castShadow position={[0, -0.49, 0.09]} scale={[1, 0.7, 1.5]}>
              <sphereGeometry args={[0.14, 10, 8]} />
              <meshStandardMaterial color="#25313a" roughness={0.9} />
            </mesh>
          </group>
        </group>

        {(drinking || carryingDrink) && (
          <group ref={mug} position={[0.48, drinking ? 1.31 : 0.84, drinking ? 0.34 : 0.28]}>
            <BeerMug color={carryingDrink ?? '#eca72c'} scale={0.92} />
          </group>
        )}
        {(activity === 'ready_to_pay' || activity === 'paying') && (
          <group position={[0.26, 0.91, 0.6]}>
            <BeerMug color="#d88c27" scale={0.82} />
          </group>
        )}
        {carryingDirty && (
          <group position={[0.46, 0.85, 0.24]}>
            <BeerMug dirty scale={0.85} />
            <group position={[-0.12, 0.07, 0.03]} rotation={[0, 0, -0.22]}><BeerMug dirty scale={0.72} /></group>
          </group>
        )}
        {(activity === 'preparing' || activity === 'cleaning' || activity === 'delivering') && (
          <Sparkles count={7} scale={[1.05, 0.7, 0.7]} position={[0, 0.95, 0.3]} size={2.8} speed={0.7} color={activity === 'cleaning' ? '#8ff5df' : '#ffd46a'} />
        )}
        {moving && (
          <Sparkles count={4} scale={[0.7, 0.18, 0.5]} position={[0, 0.13, -0.1]} size={1.8} speed={0.35} color="#f2d2a0" />
        )}
      </group>
    </group>
  );
}

export function PatronCharacter({ patron }: { patron: Patron }) {
  const seated = !['walking_in', 'leaving'].includes(patron.state);
  const moving = patron.state === 'walking_in' || patron.state === 'leaving';
  return (
    <Humanoid
      position={patron.position}
      target={patron.target}
      palette={patron.palette}
      moving={moving}
      seated={seated}
      drinking={patron.state === 'drinking'}
      activity={patron.state}
    />
  );
}

export function BartenderCharacter({ bartender }: { bartender: Bartender }) {
  const moving = bartender.state.startsWith('to_') || bartender.state === 'returning_dirty';
  return (
    <Humanoid
      position={bartender.position}
      target={bartender.target}
      palette={0}
      moving={moving}
      bartender
      carryingDrink={bartender.carryingDrink?.color ?? null}
      carryingDirty={bartender.carryingDirty}
      activity={bartender.state}
    />
  );
}
