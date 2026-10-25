'use client';

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { repairPointerFor, type RepairStep } from '@/lib/repair';
import { repairTargetPosition, type GuidanceAnchors } from '@/lib/car';

/** A separate, deliberately schematic air-cleaner explains the action without
 * pretending that the supplied composite scan has service-accurate components. */
function AirCleaner({ step, paused, reduced, anchors }: { step: RepairStep; paused: boolean; reduced: boolean; anchors: MutableRefObject<GuidanceAnchors> }) {
  const lid = useRef<THREE.Group>(null);
  const filter = useRef<THREE.Group>(null);
  const ticks = useRef(0);
  const replacement = step.action === 'fit-filter';
  const color = replacement ? '#86efbc' : '#d4b278';
  useEffect(() => {
    const cover = lid.current, element = filter.current;
    anchors.current.cover = cover; anchors.current.filter = element;
    return () => { if (anchors.current.cover === cover) anchors.current.cover = null; if (anchors.current.filter === element) anchors.current.filter = null; };
  }, [anchors]);
  useFrame((_, delta) => {
    if (!paused) ticks.current += delta;
    const t = reduced ? 0.7 : (ticks.current % 4) / 4;
    const eased = THREE.MathUtils.smoothstep(t, 0.12, 0.75);
    if (lid.current) lid.current.position.y = 0.23 + (step.action === 'open-box' ? eased * 0.52 : 0.65);
    if (filter.current) filter.current.position.y = step.action === 'remove-filter' ? 0.12 + eased * 0.43 : replacement ? 0.55 - eased * 0.43 : 0.12;
  });
  return <group position={[2.65, 1.4, 0.1]}>
    <mesh position={[0, -0.04, 0]}><boxGeometry args={[0.72, 0.1, 0.55]} /><meshStandardMaterial color="#232a32" roughness={0.55} metalness={0.25} /></mesh>
    {[[-0.34, 0, 0.04, 0.55], [0.34, 0, 0.04, 0.55], [0, -0.255, 0.64, 0.04], [0, 0.255, 0.64, 0.04]].map(([x, z, w, d], index) => <mesh key={index} position={[x, 0.055, z]}><boxGeometry args={[w, 0.12, d]} /><meshStandardMaterial color="#303a45" /></mesh>)}
    <group ref={filter}>
      <mesh><boxGeometry args={[0.6, 0.07, 0.44]} /><meshStandardMaterial color={color} /></mesh>
      {Array.from({ length: 13 }, (_, index) => <mesh key={index} position={[-0.27 + index * 0.045, 0.05, 0]}><boxGeometry args={[0.018, 0.05, 0.38]} /><meshStandardMaterial color={replacement ? '#d6ffe8' : '#f0d8ab'} /></mesh>)}
    </group>
    <group ref={lid}>
      <mesh><boxGeometry args={[0.73, 0.08, 0.56]} /><meshStandardMaterial color="#35414b" metalness={0.3} roughness={0.45} /></mesh>
      {[-0.19, -0.09, 0.01, 0.11, 0.21].map((z) => <mesh key={z} position={[0, 0.05, z]}><boxGeometry args={[0.59, 0.025, 0.022]} /><meshStandardMaterial color="#52616e" /></mesh>)}
    </group>
    <Html position={[0, -0.27, 0]} center style={{ pointerEvents: 'none' }}><span className="repair-model-label">{replacement ? 'New filter' : step.action === 'remove-filter' ? 'Old filter' : 'Air-cleaner housing'}<small>Illustrated action · confirm actual location</small></span></Html>
  </group>;
}

export default function RepairAnimation({ step, paused, reduced, showPointer, anchors }: { step: RepairStep; paused: boolean; reduced: boolean; showPointer: boolean; anchors: MutableRefObject<GuidanceAnchors> }) {
  const pointer = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const time = useRef(0);
  const filterAction = ['open-box', 'remove-filter', 'fit-filter'].includes(step.action);
  const target = repairPointerFor(step.action);
  const point = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, delta) => {
    if (!paused) time.current += delta;
    const bounce = reduced ? 0 : Math.sin(time.current * 3.4) * 0.1;
    const located = repairTargetPosition(step.action, anchors.current, point);
    if (pointer.current) { pointer.current.visible = located; pointer.current.position.copy(point); pointer.current.position.y += 0.08 + bounce; }
    if (ring.current) { ring.current.visible = located; ring.current.position.copy(point); ring.current.scale.setScalar(reduced ? 1 : 1 + Math.sin(time.current * 2.6) * 0.15); }
  });
  return <>
    {showPointer && target && <>
      <group ref={pointer} visible={false} position={[point.x, point.y + 0.08, point.z]}>
        <mesh renderOrder={1001} rotation-z={Math.PI}><coneGeometry args={[0.12, 0.3, 20]} /><meshBasicMaterial color="#ffc919" transparent depthTest={false} depthWrite={false} toneMapped={false} /></mesh>
        <mesh renderOrder={1001} position={[0, 0.32, 0]}><cylinderGeometry args={[0.035, 0.035, 0.48, 12]} /><meshBasicMaterial color="#ffc919" transparent depthTest={false} depthWrite={false} toneMapped={false} /></mesh>
      </group>
      <mesh renderOrder={1000} visible={false} ref={ring} position={point} rotation-x={-Math.PI / 2}><ringGeometry args={[0.16, 0.19, 48]} /><meshBasicMaterial color="#ffc919" transparent opacity={0.8} side={THREE.DoubleSide} depthTest={false} depthWrite={false} toneMapped={false} /></mesh>
    </>}
    {filterAction && <AirCleaner step={step} paused={paused} reduced={reduced} anchors={anchors} />}
  </>;
}
