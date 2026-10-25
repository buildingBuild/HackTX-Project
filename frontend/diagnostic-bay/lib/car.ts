import * as THREE from 'three';
import { partName } from './api';

/* =====================================================================
   Procedural car: one smooth lofted body, split into selectable parts.
   This is the stand-in until a real .glb is provided (see mapGltfParts).
   ===================================================================== */

export type CarPart = {
  id: string;
  name: string;
  meshes: THREE.Mesh[];
  state: { hover: boolean; selected: boolean; affected: boolean };
};
export type BuiltCar = { group: THREE.Group; parts: Record<string, CarPart> };

function carShape(S: any) {
  const hx = S.length / 2, Wh = S.width / 2, R = S.wheelRadius, sill = R - 0.02, arcR = R + 0.075;
  const spline = (pts: number[][], x: number) => {
    const n = pts.length;
    if (x <= pts[0][0]) return pts[0][1];
    if (x >= pts[n - 1][0]) return pts[n - 1][1];
    let i = 0; while (x > pts[i + 1][0]) i++;
    const slope = (k: number) => k <= 0 ? (pts[1][1] - pts[0][1]) / (pts[1][0] - pts[0][0]) : k >= n - 1 ? (pts[n - 1][1] - pts[n - 2][1]) / (pts[n - 1][0] - pts[n - 2][0]) : (pts[k + 1][1] - pts[k - 1][1]) / (pts[k + 1][0] - pts[k - 1][0]);
    const x0 = pts[i][0], x1 = pts[i + 1][0], y0 = pts[i][1], y1 = pts[i + 1][1], h = x1 - x0, t = (x - x0) / h, t2 = t * t, t3 = t2 * t;
    const m0 = slope(i) * h, m1 = slope(i + 1) * h;
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * m1;
  };
  const topAt = (x: number) => spline(S.top, x), halfAt = (x: number) => spline(S.half, x);
  const endF = (x: number) => { const c = 0.4, d = hx - Math.abs(x); return d >= c ? 1 : 0.52 + 0.48 * Math.sqrt(Math.max(0, 1 - Math.pow((c - d) / c, 2))); };
  const lift = (x: number) => { const d = Math.max(0, hx - Math.abs(x)); return d >= 0.28 ? 0 : 0.15 * (1 - Math.sqrt(d / 0.28)); };
  const botAt = (x: number) => {
    let y = sill + lift(x);
    [S.frontAxle, S.rearAxle].forEach((a) => { const dx = Math.abs(x - a); if (dx < arcR) y = Math.max(y, R - 0.02 + Math.sqrt(arcR * arcR - dx * dx)); });
    return y;
  };
  return { hx, Wh, R, sill, arcR, spline, topAt, halfAt, endF, botAt };
}

function loftBody(S: any, sh: any) {
  const NX = 300, NY = 44, e = 2 / 4.2, pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= NX; i++) {
    const x = -sh.hx + S.length * (0.5 - 0.5 * Math.cos(Math.PI * i / NX));
    const yt = sh.topAt(x), yb = Math.min(sh.botAt(x), yt - 0.06), hw = sh.Wh * sh.halfAt(x) * sh.endF(x), ym = (yt + yb) / 2, hh = (yt - yb) / 2;
    for (let j = 0; j < NY; j++) {
      const a = j / NY * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const pz = Math.sign(c) * Math.pow(Math.abs(c), e), py = Math.sign(s) * Math.pow(Math.abs(s), e);
      pos.push(x, ym + hh * py, hw * pz * (1 - 0.07 * Math.max(0, py)));
    }
  }
  for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
    const a = i * NY + j, b = i * NY + (j + 1) % NY, c = (i + 1) * NY + j, d = (i + 1) * NY + (j + 1) % NY;
    idx.push(a, c, b, b, c, d);
  }
  const cap = (i: number, front: boolean) => {
    const base = pos.length / 3; let cy = 0, x = 0;
    for (let j = 0; j < NY; j++) { const k = (i * NY + j) * 3; pos.push(pos[k], pos[k + 1], pos[k + 2]); cy += pos[k + 1]; x = pos[k]; }
    pos.push(x, cy / NY, 0); const c = base + NY;
    for (let j = 0; j < NY; j++) { const p = base + j, q = base + (j + 1) % NY; if (front) idx.push(c, q, p); else idx.push(c, p, q); }
  };
  cap(NX, true); cap(0, false);
  return { pos, idx };
}

function loftHouse(S: any, sh: any) {
  const NX = 150, NY = 40, e = 2 / 2.6, pos: number[] = [], idx: number[] = [], g0 = S.gBase, g1 = S.cowl;
  const prof = [[g0, 0], [g0 + (S.gRear - g0) * 0.35, 0.38], [S.gRear, 0.9], [(S.gRear + S.gFront) / 2, 1], [S.gFront, 0.92], [S.gFront + (g1 - S.gFront) * 0.5, 0.5], [g1, 0]];
  for (let i = 0; i <= NX; i++) {
    const x = g0 + (g1 - g0) * (0.5 - 0.5 * Math.cos(Math.PI * i / NX));
    const p = Math.max(0, Math.min(1, sh.spline(prof, x)));
    const yBot = sh.topAt(x) - 0.05, yTop = yBot + 0.05 + (S.roofY - yBot - 0.05) * p;
    const ym = (yTop + yBot) / 2, hh = (yTop - yBot) / 2, hw = sh.Wh * S.houseW * (1 - 0.1 * p);
    for (let j = 0; j < NY; j++) {
      const a = j / NY * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const pz = Math.sign(c) * Math.pow(Math.abs(c), e), py = Math.sign(s) * Math.pow(Math.abs(s), e);
      pos.push(x, ym + hh * py, hw * pz * (1 - 0.12 * Math.pow(Math.max(0, py), 1.2)));
    }
  }
  for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
    const a = i * NY + j, b = i * NY + (j + 1) % NY, c = (i + 1) * NY + j, d = (i + 1) * NY + (j + 1) % NY;
    idx.push(a, c, b, b, c, d);
  }
  return { pos, idx };
}

function zoneBody(S: any, sh: any) {
  const hx = sh.hx, R = sh.R;
  return (cx: number, cy: number, cz: number, _nx: number, ny: number) => {
    if (ny < -0.45) return 'under';
    for (const a of [S.frontAxle, S.rearAxle]) if (Math.hypot(cx - a, cy - (R - 0.02)) < sh.arcR + 0.03 && cy < R + sh.arcR) return 'under';
    const sd = cz < 0 ? 'l' : 'r';
    if (cx > hx - S.fbd) return (ny > 0.5 && cy > S.fbTop) ? 'hood' : 'front_bumper';
    if (cx < -hx + S.rbd) return cy < S.rbTop ? 'rear_bumper' : 'trunk';
    if (ny > 0.5) { if (cx > S.cowl) return 'hood'; if (cx < S.gBase) return 'trunk'; return 'shell'; }
    if (cy < S.rocker) return 'rocker';
    if (cx > S.doorStart) return 'fender_f' + sd;
    if (cx > S.doorMid) return 'door_f' + sd;
    if (cx > S.doorEnd) return 'door_r' + sd;
    return 'quarter_r' + sd;
  };
}
const zoneHouse = (S: any) => (cx: number, _cy: number, _cz: number, _nx: number, ny: number) => (ny > 0.45 && cx < S.gFront + 0.05 && cx > S.gRear - 0.05) ? 'roof' : 'glass';

function splitZones(pos: ArrayLike<number>, idx: ArrayLike<number>, nrm: ArrayLike<number>, fn: (...a: number[]) => string | null) {
  const out: Record<string, { p: number[]; n: number[] }> = {};
  for (let t = 0; t < idx.length; t += 3) {
    const v = [idx[t], idx[t + 1], idx[t + 2]];
    let cx = 0, cy = 0, cz = 0, nx = 0, ny = 0, nz = 0;
    v.forEach((k) => { cx += pos[k * 3]; cy += pos[k * 3 + 1]; cz += pos[k * 3 + 2]; nx += nrm[k * 3]; ny += nrm[k * 3 + 1]; nz += nrm[k * 3 + 2]; });
    const z = fn(cx / 3, cy / 3, cz / 3, nx / 3, ny / 3, nz / 3); if (!z) continue;
    const B = out[z] || (out[z] = { p: [], n: [] });
    v.forEach((k) => { B.p.push(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]); B.n.push(nrm[k * 3], nrm[k * 3 + 1], nrm[k * 3 + 2]); });
  }
  return out;
}

export function buildCar(S: any): BuiltCar {
  const T = THREE, g = new T.Group(), parts: Record<string, CarPart> = {};
  const sh = carShape(S), hx = sh.hx, Wh = sh.Wh, R = sh.R;
  const paintBase = new T.MeshPhysicalMaterial({ color: new T.Color(S.color), metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
  const M: Record<string, () => THREE.Material> = {
    paint: () => paintBase.clone(),
    dark: () => new T.MeshStandardMaterial({ color: 0x0a0b0d, metalness: 0.2, roughness: 0.7 }),
    glass: () => new T.MeshStandardMaterial({ color: 0x1d2733, metalness: 0.92, roughness: 0.12 }),
    chrome: () => new T.MeshStandardMaterial({ color: 0xcfd6df, metalness: 1, roughness: 0.22 }),
    tire: () => new T.MeshStandardMaterial({ color: 0x0e1013, roughness: 0.85, metalness: 0.05 }),
    head: () => new T.MeshStandardMaterial({ color: 0xe6eefa, emissive: new T.Color(0xbfd8ff), emissiveIntensity: 0.7, roughness: 0.2 }),
    tail: () => new T.MeshStandardMaterial({ color: 0x8a0f14, emissive: new T.Color(0xff2a2a), emissiveIntensity: 0.8, roughness: 0.3 }),
  };
  const reg = (id: string, obj: THREE.Object3D) => {
    if (!parts[id]) parts[id] = { id, name: partName(id, S), meshes: [], state: { hover: false, selected: false, affected: false } };
    obj.traverse((m: any) => {
      if (m.isMesh) {
        m.userData.partId = id; m.castShadow = true; parts[id].meshes.push(m);
        const mt = m.material; m.userData.base = { color: mt.color.clone(), emissive: mt.emissive ? mt.emissive.clone() : new T.Color(0), ei: mt.emissiveIntensity || 0 };
      }
    });
    g.add(obj); return obj;
  };
  const plain = (obj: THREE.Object3D) => { obj.traverse((m: any) => { if (m.isMesh) m.castShadow = true; }); g.add(obj); return obj; };
  const geoFrom = (pos: number[], idx: number[]) => { const q = new T.BufferGeometry(); q.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); q.setIndex(idx); q.computeVertexNormals(); return q; };
  const emit = (zones: any, matFor: (id: string) => string) => {
    Object.keys(zones).forEach((id) => {
      const b = zones[id], q = new T.BufferGeometry();
      q.setAttribute('position', new T.Float32BufferAttribute(b.p, 3)); q.setAttribute('normal', new T.Float32BufferAttribute(b.n, 3));
      const kind = matFor(id), m = new T.Mesh(q, M[kind]());
      if ((kind === 'paint' && id !== 'shell') || id === 'glass') reg(id, m); else plain(m);
    });
  };
  const bb = loftBody(S, sh), bg = geoFrom(bb.pos, bb.idx);
  emit(splitZones(bg.attributes.position.array, bb.idx, bg.attributes.normal.array, zoneBody(S, sh)), (id) => id === 'under' || id === 'rocker' ? 'dark' : 'paint');
  const hh = loftHouse(S, sh), hg = geoFrom(hh.pos, hh.idx);
  emit(splitZones(hg.attributes.position.array, hh.idx, hg.attributes.normal.array, zoneHouse(S)), (id) => id === 'glass' ? 'glass' : 'paint');

  const ell = (rx: number, ry: number, rz: number, mat: THREE.Material, x: number, y: number, z: number) => { const m = new T.Mesh(new T.SphereGeometry(1, 22, 14), mat); m.scale.set(rx, ry, rz); m.position.set(x, y, z); return m; };
  const gx = hx - 0.07; reg('grille', ell(0.05, 0.055, Wh * 0.4, M.dark(), gx, sh.topAt(gx) - 0.1, 0));
  ([[-1, 'l'], [1, 'r']] as const).forEach(([sd, k]) => {
    const hX = hx - 0.34, tX = -hx + 0.22;
    reg('headlight_' + k, ell(0.2, 0.045, 0.16, M.head(), hX, sh.topAt(hX) - 0.05, sd * Wh * sh.halfAt(hX) * 0.66));
    if (S.tailVertical) reg('taillight_' + k, ell(0.06, 0.2, 0.08, M.tail(), -hx + 0.12, sh.topAt(-hx + 0.12) + 0.02, sd * Wh * 0.9));
    else reg('taillight_' + k, ell(0.12, 0.05, 0.2, M.tail(), tX, sh.topAt(tX) - 0.06, sd * Wh * sh.halfAt(tX) * 0.68));
    const mX = S.cowl - 0.1; reg('mirror_' + k, ell(0.12, 0.06, 0.09, M.paint(), mX, sh.topAt(mX) + 0.1, sd * (Wh * 0.99)));
  });
  const fd = new T.Mesh(new T.CylinderGeometry(0.075, 0.075, 0.02, 24), M.paint()); fd.rotation.x = Math.PI / 2;
  fd.position.set(S.fuelX, sh.topAt(S.fuelX) - 0.17, Wh * sh.halfAt(S.fuelX) * 0.99 + 0.012); reg('fuel_door', fd);

  const wz = Wh - 0.14;
  const wheel = (id: string, ax: number, sd: number) => {
    const w = new T.Group(), tt = 0.075, tire = new T.Mesh(new T.TorusGeometry(R - tt, tt, 20, 48), M.tire()); tire.scale.z = 1.65; w.add(tire);
    const rr = R - 2 * tt - 0.005, hz = tt * 1.65;
    const rim = new T.Mesh(new T.CylinderGeometry(rr, rr, hz * 1.5, 40), new T.MeshStandardMaterial({ color: 0x20242b, metalness: 0.85, roughness: 0.35 })); rim.rotation.x = Math.PI / 2; w.add(rim);
    for (let i = 0; i < 5; i++) { const sp = new T.Group(); sp.rotation.z = i * Math.PI * 2 / 5; const bx = new T.Mesh(new T.BoxGeometry(0.075, rr - 0.04, 0.03), M.chrome()); bx.position.set(0, (rr - 0.04) / 2 + 0.035, hz * 0.75 + 0.012); sp.add(bx); w.add(sp); }
    const hub = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, 0.04, 24), M.chrome()); hub.rotation.x = Math.PI / 2; hub.position.z = hz * 0.75 + 0.02; w.add(hub);
    w.position.set(ax, R, sd * wz); if (sd < 0) w.rotation.y = Math.PI;
    reg(id, w);
  };
  wheel('wheel_fl', S.frontAxle, -1); wheel('wheel_fr', S.frontAxle, 1);
  wheel('wheel_rl', S.rearAxle, -1); wheel('wheel_rr', S.rearAxle, 1);
  return { group: g, parts };
}

/* ---------- highlight: yellow for hover / selected / affected parts ---------- */
const YELLOW = new THREE.Color(0xffc919);
export function refreshPart(p: CarPart) {
  const st = p.state, on = st.selected || st.affected || st.hover;
  p.meshes.forEach((m: any) => {
    const b = m.userData.base, mt = m.material;
    if (on) {
      mt.color.copy(b.color).lerp(YELLOW, st.selected || st.affected ? 0.7 : 0.45);
      if (mt.emissive) { mt.emissive.set(0xffb800); mt.emissiveIntensity = st.selected ? 0.4 : st.affected ? 0.25 : 0.15; }
    } else {
      mt.color.copy(b.color);
      if (mt.emissive) { mt.emissive.copy(b.emissive); mt.emissiveIntensity = b.ei; }
    }
  });
}

export function disposeCar(c: BuiltCar | null) {
  if (!c) return;
  c.group.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: any) => m.dispose()); });
}

/* =====================================================================
   Real models: match mesh names in a loaded .glb to part ids.
   Meshes that match nothing stay visible but are not selectable.
   ===================================================================== */
function sideOf(n: string): 'l' | 'r' | null {
  if (/(^|[^a-z])(left|lh|l)([^a-z]|$)/i.test(n) || /_l(_|$)|\.l(\.|$)/i.test(n)) return 'l';
  if (/(^|[^a-z])(right|rh|r)([^a-z]|$)/i.test(n) || /_r(_|$)|\.r(\.|$)/i.test(n)) return 'r';
  return null;
}
export function partIdForName(name: string): string | null {
  const n = name.toLowerCase(), s = sideOf(name), fr = /front|frnt|\bf\b|_f_/.test(n) ? 'f' : /rear|back|\br\b|_r_/.test(n) ? 'r' : null;
  if (/bumper/.test(n)) return fr === 'r' ? 'rear_bumper' : 'front_bumper';
  if (/grill/.test(n)) return 'grille';
  if (/hood|bonnet/.test(n)) return 'hood';
  if (/trunk|tailgate|liftgate|boot/.test(n)) return 'trunk';
  if (/roof/.test(n)) return 'roof';
  if (/windshield|windscreen|glass|window/.test(n)) return 'glass';
  if (/head.?(light|lamp)|headl/.test(n)) return s ? 'headlight_' + s : null;
  if (/tail.?(light|lamp)|taill/.test(n)) return s ? 'taillight_' + s : null;
  if (/mirror/.test(n)) return s ? 'mirror_' + s : null;
  if (/fuel|gas.?cap/.test(n)) return 'fuel_door';
  if (/wheel|tyre|tire|rim/.test(n)) return s && fr ? `wheel_${fr}${s}` : null;
  if (/fender|wing/.test(n)) return s ? 'fender_f' + s : null;
  if (/quarter/.test(n)) return s ? 'quarter_r' + s : null;
  if (/door/.test(n)) return s ? `door_${fr === 'r' ? 'r' : 'f'}${s}` : null;
  return null;
}
/* Meshes with generic names (Object_12 …): classify by material name and split the
   body-paint mesh into panels by triangle position. */
function zoneFor(mat: string, u: number, zs: number, ht: number): string | null {
  const side = zs < 0 ? 'l' : 'r', az = Math.abs(zs);
  if (/tyre|tire|rim|steel|alumin/.test(mat) && ht < 0.5) return 'wheel_' + (u > 0 ? 'f' : 'r') + side;
  if (/glass_window/.test(mat)) return 'glass';
  if (/lamp_front|projector|signal_front|fog/.test(mat) || (/^light/.test(mat) && u > 0.6)) return u > 0 ? 'headlight_' + side : null;
  if (/lamp_rear|lamp_red|rear_lamp|light_red|signal|reflector/.test(mat) || (/^light/.test(mat) && u < -0.6)) return u < 0 ? 'taillight_' + side : null;
  if (!/paint|frontcolor|body/.test(mat)) return null;
  if (ht > 0.8 && az < 0.7) return 'roof';
  if (u > 0.8 && ht < 0.55) return az < 0.5 && ht > 0.28 && ht < 0.5 ? 'grille' : 'front_bumper';
  if (u < -0.8 && ht < 0.55) return 'rear_bumper';
  if (az < 0.62) {
    if (u > 0.2 && ht > 0.45) return 'hood';
    if (u < -0.45 && ht > 0.45) return 'trunk';
    return null;
  }
  if (ht < 0.18) return null;
  if (u > 0.45) return 'fender_f' + side;
  if (u > 0.0) return 'door_f' + side;
  if (u > -0.38) return 'door_r' + side;
  return 'quarter_r' + side;
}
function splitGeneric(root: THREE.Group, spec?: any): BuiltCar {
  root.updateMatrixWorld(true);
  const items: { geo: THREE.BufferGeometry; mat: THREE.Material; name: string }[] = [];
  root.traverse((m: any) => {
    if (!m.isMesh || !m.geometry) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    items.push({ geo: g, mat: mats[0], name: (mats[0].name || '').toLowerCase() });
  });
  while (root.children.length) root.remove(root.children[0]);
  const box = new THREE.Box3(); items.forEach((i) => { i.geo.computeBoundingBox(); box.union(i.geo.boundingBox!); });
  // find the front: head-lamp materials sit at the front
  let fx = 0, fn = 0; const v = new THREE.Vector3();
  items.forEach((i) => { if (/lamp_front|projector|signal_front|fog/.test(i.name)) { i.geo.boundingBox!.getCenter(v); fx += v.x; fn++; } });
  const flip = fn > 0 && fx < 0;
  if (flip) { const r = new THREE.Matrix4().makeRotationY(Math.PI); items.forEach((i) => i.geo.applyMatrix4(r)); box.makeEmpty(); items.forEach((i) => { i.geo.computeBoundingBox(); box.union(i.geo.boundingBox!); }); }
  const hx = (box.max.x - box.min.x) / 2, cx = (box.max.x + box.min.x) / 2, Wh = (box.max.z - box.min.z) / 2, cz = (box.max.z + box.min.z) / 2, H = box.max.y - box.min.y;
  const parts: Record<string, CarPart> = {};
  const paintHex = spec?.color;
  const add = (id: string | null, geo: THREE.BufferGeometry, src: THREE.Material, name: string) => {
    const mat: any = src.clone();
    if (/body_paint/.test(name) && paintHex && mat.color) mat.color.set(paintHex);
    const mesh = new THREE.Mesh(geo, mat);
    root.add(mesh);
    if (!id) return;
    mesh.userData.partId = id;
    if (!parts[id]) parts[id] = { id, name: partName(id, spec), meshes: [], state: { hover: false, selected: false, affected: false } };
    parts[id].meshes.push(mesh);
    mesh.userData.base = { color: mat.color.clone(), emissive: mat.emissive ? mat.emissive.clone() : new THREE.Color(0), ei: mat.emissiveIntensity || 0 };
  };
  items.forEach(({ geo, mat, name }) => {
    const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal'), uv = geo.getAttribute('uv');
    const buckets = new Map<string | null, number[]>();
    for (let t = 0; t < pos.count; t += 3) {
      let x = 0, y = 0, z = 0;
      for (let k = 0; k < 3; k++) { x += pos.getX(t + k); y += pos.getY(t + k); z += pos.getZ(t + k); }
      x /= 3; y /= 3; z /= 3;
      const id = zoneFor(name, (x - cx) / hx, (z - cz) / Wh, (y - box.min.y) / H);
      let b = buckets.get(id); if (!b) buckets.set(id, b = []); b.push(t, t + 1, t + 2);
    }
    buckets.forEach((idx, id) => {
      const g = new THREE.BufferGeometry();
      const mk = (a: any, n: number) => { const arr = new Float32Array(idx.length * n); idx.forEach((vi, j) => { for (let c = 0; c < n; c++) arr[j * n + c] = a.getComponent ? a.getComponent(vi, c) : 0; }); return new THREE.BufferAttribute(arr, n); };
      g.setAttribute('position', mk(pos, 3)); if (nor) g.setAttribute('normal', mk(nor, 3)); if (uv) g.setAttribute('uv', mk(uv, 2));
      add(id, g, mat, name);
    });
  });
  return { group: root, parts };
}
export function mapGltfParts(root: THREE.Object3D, spec?: any): BuiltCar {
  const parts: Record<string, CarPart> = {};
  root.traverse((m: any) => {
    if (!m.isMesh) return;
    let id: string | null = null, o: THREE.Object3D | null = m;
    while (o && !id) { id = partIdForName(o.name || ''); o = o.parent; }
    if (!id) return;
    parts[id] = parts[id] || { id, name: partName(id, spec), meshes: [], state: { hover: false, selected: false, affected: false } };
  });
  if (Object.keys(parts).length < 4) return splitGeneric(root as THREE.Group, spec);
  Object.keys(parts).forEach((k) => delete parts[k]);
  root.traverse((m: any) => {
    if (!m.isMesh) return;
    let id: string | null = null, o: THREE.Object3D | null = m;
    while (o && !id) { id = partIdForName(o.name || ''); o = o.parent; }
    if (!id) return;
    m.material = Array.isArray(m.material) ? m.material[0].clone() : m.material.clone();
    m.userData.partId = id;
    if (!parts[id]) parts[id] = { id, name: partName(id, spec), meshes: [], state: { hover: false, selected: false, affected: false } };
    parts[id].meshes.push(m);
    const mt = m.material; m.userData.base = { color: mt.color.clone(), emissive: mt.emissive ? mt.emissive.clone() : new THREE.Color(0), ei: mt.emissiveIntensity || 0 };
  });
  return { group: root as THREE.Group, parts };
}
