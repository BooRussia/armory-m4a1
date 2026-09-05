import * as THREE from 'three';

/** Bind-pose projection and convex-edge distances, independent of camera and animation. */
export function prepareSurfaceGeometry(mesh: THREE.Mesh) {
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const count = position.count;
  const points: THREE.Vector3[] = [];
  const surface = new Float32Array(count * 3);
  const directions = new Float32Array(count * 3);
  const distances = new Float32Array(count * 3).fill(1000);
  const extraDistances = new Float32Array(count * 3).fill(1000);
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const welded = new Map<string, number>();
  const vertexIds: number[] = [];
  for (let i = 0; i < count; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    points.push(point);
    point.toArray(surface, i * 3);
    const direction = normal ? new THREE.Vector3().fromBufferAttribute(normal, i).applyNormalMatrix(normalMatrix) : new THREE.Vector3(0, 1, 0);
    direction.toArray(directions, i * 3);
    const key = [point.x, point.y, point.z].map(n => Math.round(n * 1e5)).join(',');
    if (!welded.has(key)) welded.set(key, welded.size);
    vertexIds.push(welded.get(key)!);
  }
  type Edge = { start: number; a: number; b: number; opposite: number; slot: number; normal: THREE.Vector3 };
  const edges = new Map<string, Edge[]>();
  const parents = Array.from({ length: Math.ceil(count / 3) }, (_, i) => i);
  function faceRoot(i: number): number {
    while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; }
    return i;
  }
  for (let start = 0; start + 2 < count; start += 3) {
    const face = new THREE.Vector3().subVectors(points[start + 1], points[start]).cross(new THREE.Vector3().subVectors(points[start + 2], points[start])).normalize();
    if (face.lengthSq() < .5) continue;
    for (let slot = 0; slot < 3; slot++) {
      const a = start + slot, b = start + (slot + 1) % 3, opposite = start + (slot + 2) % 3;
      const key = [vertexIds[a], vertexIds[b]].sort((x, y) => x - y).join(':');
      const edge = { start, a, b, opposite, slot, normal: face };
      const adjacent = edges.get(key);
      if (adjacent) adjacent.push(edge); else edges.set(key, [edge]);
    }
  }
  let convexEdges = 0;
  const delta = new THREE.Vector3();
  const convex: Edge[] = [];
  // Coplanar neighbors must sample the same edge fields at their shared vertices.
  for (const adjacent of edges.values()) {
    if (adjacent.length === 2 && adjacent[0].normal.dot(adjacent[1].normal) > .99999) {
      parents[faceRoot(adjacent[0].start / 3)] = faceRoot(adjacent[1].start / 3);
    }
  }
  for (const adjacent of edges.values()) {
    // Ignore open/non-manifold edges, coplanar triangulation and shallow cylinder facets.
    if (adjacent.length !== 2) continue;
    const [a, b] = adjacent;
    if (a.normal.dot(b.normal) > Math.cos(THREE.MathUtils.degToRad(35))) continue;
    if (a.normal.dot(delta.subVectors(points[b.opposite], points[a.a])) >= -1e-7
      || b.normal.dot(delta.subVectors(points[a.opposite], points[b.a])) >= -1e-7) continue;
    convexEdges++;
    convex.push(...adjacent);
  }
  const fields = new Map<number, Edge[]>();
  for (const edge of convex) {
    const group = faceRoot(edge.start / 3);
    if (!fields.has(group)) fields.set(group, []);
    fields.get(group)!.push(edge);
  }
  const segment = new THREE.Vector3(), closest = new THREE.Vector3();
  function distance(point: THREE.Vector3, edge: Edge) {
    segment.subVectors(points[edge.b], points[edge.a]);
    const t = THREE.MathUtils.clamp(delta.subVectors(point, points[edge.a]).dot(segment) / Math.max(segment.lengthSq(), 1e-12), 0, 1);
    return point.distanceTo(closest.copy(points[edge.a]).addScaledVector(segment, t));
  }
  for (let start = 0; start + 2 < count; start += 3) {
    const candidates = (fields.get(faceRoot(start / 3)) ?? []).map(edge => {
      const values = [distance(points[start], edge), distance(points[start + 1], edge), distance(points[start + 2], edge)];
      return { values, nearest: Math.min(...values) };
    }).sort((a, b) => a.nearest - b.nearest).slice(0, 6);
    candidates.forEach(({ values }, slot) => {
      const target = slot < 3 ? distances : extraDistances;
      for (let v = 0; v < 3; v++) target[(start + v) * 3 + slot % 3] = values[v];
    });
  }
  geometry.setAttribute('armoryPosition', new THREE.BufferAttribute(surface, 3));
  geometry.setAttribute('armoryDirection', new THREE.BufferAttribute(directions, 3));
  geometry.setAttribute('armoryEdgeDistance', new THREE.BufferAttribute(distances, 3));
  geometry.setAttribute('armoryEdgeDistanceB', new THREE.BufferAttribute(extraDistances, 3));
  geometry.userData.armoryConvexEdges = convexEdges;
  return geometry;
}
