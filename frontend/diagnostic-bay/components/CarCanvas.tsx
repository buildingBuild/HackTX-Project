'use client';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { buildCar, disposeCar, mapGltfParts, refreshPart, type BuiltCar } from '@/lib/car';

export type ViewRequest = { k: 'front' | 'side' | 'top'; n: number } | null;

type Props = {
  spec: any;
  modelUrl?: string;
  affected: string[];
  selected: string | null;
  hover: string | null;
  view: ViewRequest;
  auto: boolean;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onUserMove: () => void;
};

/* soft studio floor with faint rings */
function Floor() {
  const tex = useMemo(() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 512;
    const x = cv.getContext('2d')!;
    const gr = x.createRadialGradient(256, 256, 0, 256, 256, 256);
    gr.addColorStop(0, '#323235'); gr.addColorStop(0.7, '#18181a'); gr.addColorStop(1, 'rgba(12,12,13,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 512, 512);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  return (
    <mesh rotation-x={-Math.PI / 2}>
      <circleGeometry args={[5.4, 72]} />
      <meshStandardMaterial map={tex} color="#8a8a90" transparent roughness={0.6} metalness={0.2} />
    </mesh>
  );
}

function Studio() {
  return (
    <>
      <Environment resolution={256} environmentIntensity={0.9}>
        <color attach="background" args={['#1c1c1f']} />
        <Lightformer form="rect" intensity={6} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[18, 5, 1]} />
        <Lightformer form="rect" intensity={3} position={[-12, 5, 0]} rotation-y={Math.PI / 2} scale={[16, 5, 1]} />
        <Lightformer form="rect" intensity={3} position={[12, 5, 2]} rotation-y={-Math.PI / 2} scale={[12, 5, 1]} />
        <Lightformer form="rect" intensity={2} position={[0, 5, -14]} scale={[16, 4, 1]} />
      </Environment>
      <directionalLight position={[5, 9, 4]} intensity={1.4} />
      <directionalLight position={[-6, 3, -5]} intensity={0.8} color="#d5ddff" />
      <Floor />
      <ContactShadows position={[0, 0.004, 0]} opacity={0.6} scale={14} blur={2.4} far={3} resolution={512} />
    </>
  );
}

/* click, hover, and yellow highlight shared by the generated car and loaded models */
function Highlight({ built, ...p }: { built: BuiltCar } & Pick<Props, 'affected' | 'selected' | 'hover' | 'onSelect' | 'onHover'>) {
  useEffect(() => {
    Object.values(built.parts).forEach((part) => {
      const st = part.state, a = p.affected.includes(part.id), s = p.selected === part.id, h = p.hover === part.id;
      if (st.affected !== a || st.selected !== s || st.hover !== h) { st.affected = a; st.selected = s; st.hover = h; refreshPart(part); }
    });
  }, [built, p.affected, p.selected, p.hover]);
  const reduced = useMemo(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  useFrame(({ clock }) => {
    if (reduced) return;
    const k = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.6);
    p.affected.forEach((id) => {
      const part = built.parts[id]; if (!part || part.state.selected) return;
      part.meshes.forEach((m: any) => { if (m.material.emissive) m.material.emissiveIntensity = 0.2 + 0.32 * k; });
    });
  });
  return (
    <primitive
      object={built.group}
      onPointerMove={(e: any) => { e.stopPropagation(); const id = e.object.userData.partId ?? null; p.onHover(id); document.body.style.cursor = id ? 'pointer' : 'grab'; }}
      onPointerOut={() => { p.onHover(null); document.body.style.cursor = ''; }}
      onClick={(e: any) => {
        if (e.delta > 6) return;
        e.stopPropagation();
        const id = e.object.userData.partId;
        if (id) p.onSelect(id === p.selected ? null : id);
      }}
    />
  );
}

function ProceduralCar(p: Props) {
  const built = useMemo(() => buildCar(p.spec), [p.spec]);
  useEffect(() => () => disposeCar(built), [built]);
  return <Highlight built={built} {...p} />;
}

/* a real .glb: centred, put on the floor and scaled to the car's length */
function GltfCar(p: Props) {
  const { scene } = useGLTF(p.modelUrl!);
  const built = useMemo(() => {
    const root = scene.clone(true);
    const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
    if (size.z > size.x) root.rotation.y = Math.PI / 2;
    const wrap = new THREE.Group(); wrap.add(root);
    const b2 = new THREE.Box3().setFromObject(wrap), s2 = b2.getSize(new THREE.Vector3()), c = b2.getCenter(new THREE.Vector3());
    const k = p.spec.length / Math.max(s2.x, 0.001);
    wrap.scale.setScalar(k); wrap.position.set(-c.x * k, -b2.min.y * k, -c.z * k);
    const outer = new THREE.Group(); outer.add(wrap);
    return mapGltfParts(outer, p.spec);
  }, [scene, p.spec]);
  return <Highlight built={built} {...p} />;
}

/* keep the whole car in frame on narrow (portrait) screens */
function Fit({ d }: { d: number }) {
  const camera = useThree((s) => s.camera), size = useThree((s) => s.size), controls: any = useThree((s) => s.controls);
  useEffect(() => {
    const a = size.width / Math.max(size.height, 1), th = Math.tan(((camera as any).fov || 24) * Math.PI / 360) * a, k = Math.max(1, (d / 2) * 0.62 / th / d);
    camera.position.setLength(d * k);
    if (controls) { controls.maxDistance = d * k * 1.6; controls.update(); }
  }, [size.width, size.height, d, camera, controls]);
  return null;
}

/* camera presets: front, side, top */
function Rig({ view, length }: { view: ViewRequest; length: number }) {
  const camera = useThree((s) => s.camera);
  const controls: any = useThree((s) => s.controls);
  const tw = useRef<any>(null);
  useEffect(() => {
    if (!view) return;
    const L = length;
    const P = { side: [0, L * 0.16, L * 2.2], front: [L * 2.1, L * 0.2, 0.01], top: [0.01, L * 2.6, 0.01] }[view.k];
    tw.current = { from: camera.position.clone(), to: new THREE.Vector3(P[0], P[1], P[2]), t0: performance.now() };
  }, [view, length, camera]);
  useEffect(() => {
    if (!controls) return;
    const stop = () => { tw.current = null; };
    controls.addEventListener('start', stop);
    return () => controls.removeEventListener('start', stop);
  }, [controls]);
  useFrame(() => {
    const t = tw.current; if (!t) return;
    const q = Math.min(1, (performance.now() - t.t0) / 800), e = q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
    camera.position.lerpVectors(t.from, t.to, e);
    if (q >= 1) tw.current = null;
  });
  return null;
}

export default function CarCanvas(p: Props) {
  const L = p.spec.length, d = L * 2.0;
  const target = useMemo(() => [0, 0.62, 0] as [number, number, number], []);
  return (
    <div className="glwrap" aria-label="Interactive 3D model of the customer's car. Drag to rotate, tap a part to inspect it.">
      <Canvas dpr={[1, 2]} camera={{ fov: 24, near: 0.1, far: 100, position: [d * 0.78, d * 0.2, d * 0.62] }} onPointerMissed={() => p.onSelect(null)}>
        <Studio />
        <Suspense fallback={null}>{p.modelUrl ? <GltfCar {...p} /> : <ProceduralCar {...p} />}</Suspense>
        <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.08} minDistance={L * 1.3} maxDistance={L * 3.4} maxPolarAngle={Math.PI / 2 - 0.04} target={target} autoRotate={p.auto} autoRotateSpeed={0.7} onStart={p.onUserMove} />
        <Rig view={p.view} length={L} />
        <Fit d={d} />
      </Canvas>
    </div>
  );
}
