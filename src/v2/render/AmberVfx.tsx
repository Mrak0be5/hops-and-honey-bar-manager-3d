import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ViewEvent, ViewEventKind } from '../view/model';
import { AMBER_PALETTE } from './palette';

const EVENT_COLORS: Record<ViewEventKind, string> = {
  coin: AMBER_PALETTE.honey,
  upgrade: AMBER_PALETTE.tealLight,
  unlock: AMBER_PALETTE.karaokeHot,
  service: AMBER_PALETTE.cream,
  warning: AMBER_PALETTE.warning,
  karaoke: AMBER_PALETTE.karaokeBlue,
  steam: '#e8f3e9',
  aroma: AMBER_PALETTE.massageLight,
};

function EventParticleGeometry({ kind }: { kind: ViewEventKind }) {
  if (kind === 'coin') return <cylinderGeometry args={[0.095, 0.095, 0.035, 12]} />;
  if (kind === 'upgrade') return <coneGeometry args={[0.09, 0.22, 7]} />;
  if (kind === 'unlock') return <boxGeometry args={[0.13, 0.13, 0.13]} />;
  if (kind === 'warning') return <octahedronGeometry args={[0.1, 0]} />;
  if (kind === 'karaoke') return <torusGeometry args={[0.09, 0.025, 6, 12, Math.PI * 1.55]} />;
  return <sphereGeometry args={[0.075, 8, 6]} />;
}

export function AmberEventVfx({
  event,
  reducedMotion = false,
}: {
  event: ViewEvent | null | undefined;
  reducedMotion?: boolean;
}) {
  const root = useRef<THREE.Group>(null);
  const particles = useRef<THREE.Group>(null);
  const flash = useRef<THREE.Mesh>(null);
  const elapsed = useRef(0);
  const vectors = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const angle = (index / 12) * Math.PI * 2 + (index % 2) * 0.18;
    const speed = 0.72 + (index % 4) * 0.18;
    return {
      velocity: new THREE.Vector3(Math.cos(angle) * speed, 1.05 + (index % 3) * 0.2, Math.sin(angle) * speed),
      spin: 2.4 + (index % 5) * 0.42,
    };
  }), []);

  useEffect(() => {
    elapsed.current = 0;
    if (root.current) root.current.visible = Boolean(event);
  }, [event?.id]);

  useFrame((_, delta) => {
    if (!event || !root.current || !particles.current) return;
    root.current.position.set(event.position.x, 0.75, event.position.z);
    if (reducedMotion) {
      particles.current.visible = false;
      if (flash.current) {
        flash.current.scale.setScalar(0.8);
        const material = flash.current.material as THREE.MeshBasicMaterial;
        material.opacity = 0.24;
      }
      return;
    }
    particles.current.visible = true;
    elapsed.current += delta;
    const time = elapsed.current;
    const lifetime = event.kind === 'unlock' || event.kind === 'upgrade' ? 1.35 : 1.05;
    if (time >= lifetime) {
      root.current.visible = false;
      return;
    }
    particles.current.children.forEach((child, index) => {
      const data = vectors[index];
      const lift = event.kind === 'upgrade' ? 1.35 : 1;
      child.position.set(
        data.velocity.x * time,
        data.velocity.y * time * lift - 1.25 * time * time,
        data.velocity.z * time,
      );
      child.rotation.x += delta * data.spin;
      child.rotation.y += delta * (data.spin + 0.7);
      const remaining = Math.max(0.01, 1 - time / lifetime);
      child.scale.setScalar((event.kind === 'coin' ? 1 : 0.8) * remaining);
      const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity = Math.min(1, remaining * 1.4);
    });
    if (flash.current) {
      const progress = time / lifetime;
      flash.current.scale.setScalar(0.35 + progress * 2.6);
      const material = flash.current.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 0.5 * (1 - progress) ** 2);
    }
  });

  if (!event) return null;
  const color = EVENT_COLORS[event.kind];
  return (
    <group ref={root} position={[event.position.x, 0.75, event.position.z]}>
      <group ref={particles}>
        {vectors.map((_, index) => (
          <mesh key={index}>
            <EventParticleGeometry kind={event.kind} />
            <meshBasicMaterial color={index % 3 === 0 ? AMBER_PALETTE.cream : color} transparent depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <mesh ref={flash} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.36, 0.45, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function KaraokeAtmosphere({ active, quality = 1 }: { active: boolean; quality?: number }) {
  const beams = useRef<THREE.Group>(null);
  const notes = useRef<THREE.Group>(null);
  const noteCount = quality < 0.75 ? 4 : 7;

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    if (beams.current) {
      beams.current.visible = active;
      beams.current.children.forEach((beam, index) => {
        beam.rotation.z = -0.3 + Math.sin(time * 0.65 + index * 1.9) * 0.26;
        const material = (beam as THREE.Mesh).material as THREE.MeshBasicMaterial;
        material.opacity = active ? 0.08 + Math.sin(time * 2 + index) * 0.025 : 0;
      });
    }
    if (notes.current) {
      notes.current.visible = active;
      notes.current.children.forEach((note, index) => {
        const progress = (time * (0.16 + index * 0.008) + index / noteCount) % 1;
        note.position.set(-2.7 + (index % 4) * 1.75, 0.7 + progress * 2.4, -0.6 + Math.sin(time + index) * 0.32);
        note.rotation.z = Math.sin(time * 1.4 + index) * 0.28;
        const fade = Math.sin(progress * Math.PI);
        note.scale.setScalar(0.55 + fade * 0.55);
        const material = (note.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
        material.opacity = fade * 0.72;
      });
    }
  });

  return (
    <group>
      <group ref={beams} position={[0, 2.85, -2.8]}>
        {[-1.6, 0, 1.6].map((x, index) => (
          <mesh key={x} position={[x, -1.25, 1.4]} rotation={[Math.PI / 2, 0, index * 0.2]}>
            <coneGeometry args={[1.25, 3.9, 20, 1, true]} />
            <meshBasicMaterial color={index % 2 ? AMBER_PALETTE.karaokeHot : AMBER_PALETTE.karaokeBlue} transparent opacity={0.1} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <group ref={notes}>
        {Array.from({ length: noteCount }, (_, index) => (
          <group key={index}>
            <mesh>
              <torusGeometry args={[0.085, 0.025, 6, 14]} />
              <meshBasicMaterial color={index % 2 ? AMBER_PALETTE.karaokeHot : AMBER_PALETTE.karaokeBlue} transparent opacity={0.65} depthWrite={false} toneMapped={false} />
            </mesh>
            <mesh position={[0.09, 0.19, 0]} rotation={[0, 0, -0.15]}><boxGeometry args={[0.035, 0.38, 0.035]} /><meshBasicMaterial color={index % 2 ? AMBER_PALETTE.karaokeHot : AMBER_PALETTE.karaokeBlue} transparent opacity={0.65} toneMapped={false} /></mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

export function SaunaSteam({ active, quality = 1 }: { active: boolean; quality?: number }) {
  const steam = useRef<THREE.Group>(null);
  const count = quality < 0.75 ? 7 : 12;

  useFrame(({ clock }) => {
    if (!steam.current) return;
    const time = clock.elapsedTime;
    steam.current.visible = active;
    steam.current.children.forEach((puff, index) => {
      const progress = (time * (0.11 + (index % 3) * 0.018) + index / count) % 1;
      puff.position.set(
        2.55 + Math.sin(time * 0.45 + index) * 0.38,
        0.55 + progress * 2.5,
        1.2 + Math.cos(time * 0.3 + index) * 0.34,
      );
      puff.scale.set(0.55 + progress * 0.8, 0.75 + progress * 0.95, 0.55 + progress * 0.8);
      const material = (puff as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity = Math.sin(progress * Math.PI) * 0.14;
    });
  });

  return (
    <group ref={steam}>
      {Array.from({ length: count }, (_, index) => (
        <mesh key={index}>
          <sphereGeometry args={[0.38, 9, 7]} />
          <meshBasicMaterial color={index % 2 ? '#f7eee0' : '#dff2ea'} transparent opacity={0.1} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

export function MassageAroma({ active, quality = 1 }: { active: boolean; quality?: number }) {
  const wisps = useRef<THREE.Group>(null);
  const count = quality < 0.75 ? 3 : 5;

  useFrame(({ clock }) => {
    if (!wisps.current) return;
    const time = clock.elapsedTime;
    wisps.current.visible = active;
    wisps.current.children.forEach((wisp, index) => {
      const progress = (time * 0.12 + index / count) % 1;
      wisp.position.set(-1.7 + (index % 3) * 1.7 + Math.sin(time + index) * 0.16, 0.72 + progress * 1.6, -0.7);
      wisp.rotation.set(Math.PI / 2, time * 0.18 + index, Math.sin(time * 0.55 + index) * 0.22);
      wisp.scale.setScalar(0.65 + progress * 0.55);
      const material = (wisp as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity = Math.sin(progress * Math.PI) * 0.28;
    });
  });

  return (
    <group ref={wisps}>
      {Array.from({ length: count }, (_, index) => (
        <mesh key={index}>
          <torusGeometry args={[0.33, 0.025, 6, 24, Math.PI * 1.42]} />
          <meshBasicMaterial color={index % 2 ? AMBER_PALETTE.massageLight : AMBER_PALETTE.honeyLight} transparent opacity={0.24} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
