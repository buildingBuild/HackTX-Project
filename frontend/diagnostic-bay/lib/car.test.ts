import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as THREE from 'three';
import { createHoodPivot, partIdForName, prepareGltfCar } from './car';

// Reconstruct each asset's actual node transforms and accessor bounds without
// needing a browser to decode embedded textures. This checks normalization,
// component mapping, and hinge motion against the supplied files themselves.
function assetBoundsScene(file: string) {
  const bytes = readFileSync(path.join(process.cwd(), 'public/models', file));
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  const nodes: THREE.Object3D[] = json.nodes.map((node: any) => {
    const group = new THREE.Group(); group.name = node.name || '';
    if (node.matrix) { group.matrix.fromArray(node.matrix); group.matrix.decompose(group.position, group.quaternion, group.scale); }
    if (node.translation) group.position.fromArray(node.translation);
    if (node.rotation) group.quaternion.fromArray(node.rotation);
    if (node.scale) group.scale.fromArray(node.scale);
    if (node.mesh != null) for (const primitive of json.meshes[node.mesh].primitives) {
      const accessor = json.accessors[primitive.attributes.POSITION];
      const min = new THREE.Vector3().fromArray(accessor.min), max = new THREE.Vector3().fromArray(accessor.max);
      const size = max.clone().sub(min), center = max.clone().add(min).multiplyScalar(0.5);
      const geometry = new THREE.BoxGeometry(size.x, size.y, size.z); geometry.translate(center.x, center.y, center.z);
      const material = new THREE.MeshStandardMaterial(); material.name = json.materials[primitive.material]?.name || '';
      group.add(new THREE.Mesh(geometry, material));
    }
    return group;
  });
  json.nodes.forEach((node: any, index: number) => node.children?.forEach((child: number) => nodes[index].add(nodes[child])));
  const root = new THREE.Group(); json.scenes[json.scene || 0].nodes.forEach((index: number) => root.add(nodes[index]));
  return root;
}

test('LC300 exporter names map doors, bumpers, hood, and scan without destructive generic splitting', () => {
  assert.equal(partIdForName('T:SK_Door_BL_101_MI_Leather'), 'door_rl');
  assert.equal(partIdForName('T:SK_Door_FR_101_MI_Glass'), 'door_fr');
  assert.equal(partIdForName('T:SM_Bumper_B_101_MI_Paint'), 'rear_bumper');
  assert.equal(partIdForName('Hood_Open_80deg_T:SK_Hood_101'), 'hood');
  assert.equal(partIdForName('HDJ100_engine_scan_0'), 'engine');
});

test('both supplied models have the same normalized length and preserve selectable engine parts', () => {
  for (const filename of ['land-cruiser-300.glb', 'land-cruiser-300-open-hood.glb']) {
    const scene = assetBoundsScene(filename);
    const built = prepareGltfCar(scene, { length: 4.985 });
    const bounds = new THREE.Box3().setFromObject(built.group);
    assert.ok(Math.abs(bounds.getSize(new THREE.Vector3()).x - 4.985) < 0.001, filename);
    assert.ok(Math.abs(bounds.min.y) < 0.001, filename);
    assert.equal(built.parts.hood.meshes.length, 4, filename);
    assert.ok(built.parts.engine.meshes.length >= 4, filename);
    for (const corner of ['fl', 'fr', 'rl', 'rr']) assert.ok(built.parts[`door_${corner}`], filename);
    assert.ok(built.group.children[0].children.length > 0, 'original hierarchy is retained');
  }
});

test('hood pivot moves only the hood, with the open hood higher than the closed pose', () => {
  const built = prepareGltfCar(assetBoundsScene('land-cruiser-300-open-hood.glb'), { length: 4.985 });
  const engineBefore = new THREE.Box3().setFromObject(built.parts.engine.meshes[0]);
  const pivot = createHoodPivot(built)!;
  const opened = new THREE.Box3().setFromObject(pivot);
  pivot.rotation.z = -THREE.MathUtils.degToRad(80);
  const closed = new THREE.Box3().setFromObject(pivot);
  const engineAfter = new THREE.Box3().setFromObject(built.parts.engine.meshes[0]);
  assert.ok(opened.max.y > closed.max.y + 0.7, JSON.stringify({ opened: opened.max.toArray(), closed: closed.max.toArray(), pivot: pivot.position.toArray() }));
  assert.ok(engineBefore.min.distanceTo(engineAfter.min) < 0.001);
  assert.ok(engineBefore.max.distanceTo(engineAfter.max) < 0.001);
});
