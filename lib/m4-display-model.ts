import * as THREE from 'three';

/**
 * Original, artist-authored display geometry. All coordinates are arbitrary
 * scene units. Exterior surfaces only; this is not mechanical or fabrication data.
 * X points along the silhouette, with the decorative muzzle toward negative X.
 */
export interface M4Config {
  stock: 'classic' | 'compact' | 'precision';
  handguard: 'quad' | 'slim' | 'skeleton';
  optic: 'iron' | 'reflex' | 'scope';
  magazine: 'standard' | 'short' | 'extended';
  muzzle: 'standard' | 'shroud';
  foregrip: 'none' | 'vertical' | 'angled';
  finish: 'graphite' | 'sand' | 'olive';
  detail: 'clean' | 'worn';
}

export const defaultM4Config: M4Config = {
  stock: 'classic', handguard: 'quad', optic: 'reflex',
  magazine: 'standard', muzzle: 'standard', foregrip: 'none',
  finish: 'graphite', detail: 'clean',
};

export type M4Slot = 'stock' | 'handguard' | 'optic' | 'magazine' | 'muzzle' | 'foregrip' | 'finish';
type Point = [number, number];
type Surface = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial | THREE.MeshBasicMaterial;

function noiseTexture(seed: number, low: number, high: number) {
  const data = new Uint8Array(128 * 128 * 4);
  let state = seed;
  for (let i = 0; i < data.length; i += 4) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const v = low + Math.round((state / 4294967296) * (high - low));
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, 128, 128, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function outline(points: Point[]) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  return shape;
}

function capsulePath(x: number, y: number, w: number, h: number) {
  const p = new THREE.Path();
  const r = Math.min(h, w) / 2;
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y);
  p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + h - r);
  p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h);
  p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r);
  p.quadraticCurveTo(x, y, x + r, y);
  p.closePath();
  return p;
}

function shapeFromPath(p: THREE.Path) {
  return new THREE.Shape(p.getPoints(8));
}

/** Reduces exterior details to a handful of draw calls per selectable slot. */
function batchSlot(group: THREE.Group) {
  group.updateMatrixWorld(true);
  const collections = new Map<THREE.Material, THREE.Mesh[]>();
  const inverse = group.matrixWorld.clone().invert();
  group.traverse(obj => {
    if (!(obj instanceof THREE.Mesh) || Array.isArray(obj.material) || obj.material.transparent) return;
    const list = collections.get(obj.material) ?? [];
    list.push(obj);
    collections.set(obj.material, list);
  });
  collections.forEach((meshes, material) => {
    const positions: number[] = [], normals: number[] = [], uvs: number[] = [];
    for (const mesh of meshes) {
      const original = mesh.geometry;
      const g = original.index ? original.toNonIndexed() : original.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
      const p = g.getAttribute('position'), n = g.getAttribute('normal'), uv = g.getAttribute('uv');
      for (let i = 0; i < p.count; i++) {
        positions.push(p.getX(i), p.getY(i), p.getZ(i));
        normals.push(n.getX(i), n.getY(i), n.getZ(i));
        uvs.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
      }
      mesh.removeFromParent();
      original.dispose();
      g.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = `${group.name} / ${material.name || 'surface'}`;
    mesh.userData.slot = group.userData.slot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });
}

export function createM4Model(input: Partial<M4Config> = {}): THREE.Group {
  const config: M4Config = { ...defaultM4Config, ...input };
  const root = new THREE.Group();
  root.name = 'M4 / original exterior display model';
  root.userData.config = { ...config };
  root.userData.displayOnly = true;

  const palette = {
    graphite: { shell: '#30363a', polymer: '#22272a', light: '#50595c', accent: '#778181' },
    sand: { shell: '#998971', polymer: '#746852', light: '#b4a28a', accent: '#d5c6aa' },
    olive: { shell: '#656c51', polymer: '#444c38', light: '#848968', accent: '#a5aa84' },
  }[config.finish];
  const grain = noiseTexture(731, 90, 172);
  const fineGrain = noiseTexture(1223, 112, 145);
  const roughness = config.detail === 'worn' ? 0.53 : 0.4;
  function material(name: string, color: THREE.ColorRepresentation, metalness: number, rough: number, bump = false) {
    const m = new THREE.MeshStandardMaterial({ color, metalness, roughness: rough,
      ...(bump ? { bumpMap: grain, bumpScale: 0.007 } : { bumpMap: fineGrain, bumpScale: 0.0015 }) });
    m.name = name;
    return m;
  }
  const shell = material('ceramic anodized exterior', palette.shell, 0.68, roughness);
  const polymer = material('molded polymer', palette.polymer, 0.12, 0.7, true);
  const raised = material('machined edge faces', palette.light, 0.72, 0.36);
  const accent = material('subtle finish highlight', palette.accent, 0.6, 0.5);
  const steel = material('dark satin steel', '#242b31', 0.83, 0.32);
  const edge = material('steel edge highlights', '#5a646b', 0.86, 0.3);
  const dark = material('recess shadow', '#080d11', 0.3, 0.69);
  const rubber = material('soft rubber', '#13191b', 0.02, 0.86, true);
  const screwMetal = material('fastener caps', '#4c5458', 0.9, 0.28);
  const white = material('ivory engraved marks', '#bdc2b6', 0.15, 0.7);
  const red = material('safety indicator paint', '#b65c40', 0.14, 0.64);
  const glass = new THREE.MeshPhysicalMaterial({ color: '#48a4b0', metalness: 0.15,
    roughness: 0.07, transparent: true, opacity: 0.43, clearcoat: 1, side: THREE.DoubleSide });
  glass.name = 'coated optic glass';
  const glassDark = new THREE.MeshPhysicalMaterial({ color: '#163c41', metalness: 0.5,
    roughness: 0.12, clearcoat: 1, side: THREE.DoubleSide });
  glassDark.name = 'coated objective face';
  const glow = new THREE.MeshBasicMaterial({ color: '#ff653d', toneMapped: false });
  glow.name = 'tiny reflex indicator';

  function slot(name: M4Slot) {
    const g = new THREE.Group();
    g.name = name;
    g.userData.slot = name;
    root.add(g);
    return g;
  }
  function mesh(g: THREE.Group, geometry: THREE.BufferGeometry, mat: Surface, name = '') {
    const m = new THREE.Mesh(geometry, mat);
    m.name = name;
    m.userData.slot = g.userData.slot;
    m.castShadow = !mat.transparent;
    m.receiveShadow = true;
    g.add(m);
    return m;
  }
  function shape(g: THREE.Group, path: THREE.Shape | Point[], depth: number, z: number, mat: Surface, bevel = 0.018) {
    const geometry = new THREE.ExtrudeGeometry(Array.isArray(path) ? outline(path) : path, {
      depth, bevelEnabled: bevel > 0, bevelThickness: bevel,
      bevelSize: bevel, bevelSegments: 2, steps: 1, curveSegments: 8,
    });
    geometry.translate(0, 0, z - depth / 2);
    return mesh(g, geometry, mat);
  }
  function box(g: THREE.Group, x: number, y: number, z: number, w: number, h: number, d: number, mat: Surface, b = 0.008) {
    return shape(g, [[x - w / 2, y - h / 2], [x + w / 2, y - h / 2],
      [x + w / 2, y + h / 2], [x - w / 2, y + h / 2]], d, z, mat, b);
  }
  function cyl(g: THREE.Group, x: number, y: number, z: number, r: number, len: number,
    mat: Surface, axis: 'x' | 'y' | 'z' = 'z', segments = 24, r2 = r) {
    const m = mesh(g, new THREE.CylinderGeometry(r, r2, len, segments, 1), mat);
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z);
    return m;
  }
  function line(g: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, r: number, mat: Surface, segments = 8) {
    const delta = b.clone().sub(a);
    const m = mesh(g, new THREE.CylinderGeometry(r, r, delta.length(), segments), mat);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    m.position.copy(a).add(b).multiplyScalar(0.5);
    return m;
  }
  function pin(g: THREE.Group, x: number, y: number, z: number, radius = 0.036, mat = screwMetal) {
    const s = Math.sign(z) || 1;
    cyl(g, x, y, z, radius + 0.008, 0.014, dark);
    cyl(g, x, y, z + s * 0.011, radius, 0.02, mat, 'z', 16);
    const socket = cyl(g, x, y, z + s * 0.024, radius * 0.44, 0.002, dark, 'z', 6);
    socket.rotation.y = 0.17;
  }
  function pill(g: THREE.Group, x: number, y: number, z: number, w: number, h: number, mat: Surface, d = 0.008) {
    return shape(g, shapeFromPath(capsulePath(x - w / 2, y - h / 2, w, h)), d, z, mat, 0.003);
  }
  function mark(g: THREE.Group, x: number, y: number, z: number, width = 0.045, mat = white) {
    return box(g, x, y, z, width, 0.008, 0.002, mat, 0);
  }
  function rail(g: THREE.Group, from: number, to: number, y: number, z = 0, side = false) {
    const length = to - from;
    if (!side) {
      shape(g, [[from, y - 0.07], [to, y - 0.07], [to - 0.035, y + 0.012], [from + 0.035, y + 0.012]], 0.27, z, steel, 0.006);
      const count = Math.floor(length / 0.112);
      for (let i = 0; i <= count; i++) {
        const x = from + 0.035 + i * (length - 0.07) / count;
        shape(g, [[x - 0.031, y + 0.008], [x + 0.031, y + 0.008], [x + 0.039, y + 0.048], [x + 0.028, y + 0.072], [x - 0.028, y + 0.072], [x - 0.039, y + 0.048]], 0.34, z, shell, 0.004);
      }
    } else {
      box(g, (from + to) / 2, y, z, length, 0.21, 0.054, steel, 0.009);
      const count = Math.floor(length / 0.116);
      for (let i = 0; i <= count; i++) {
        const x = from + 0.035 + i * (length - 0.07) / count;
        shape(g, [[x - 0.034, y - 0.09], [x + 0.034, y - 0.09], [x + 0.027, y + 0.09], [x - 0.027, y + 0.09]], 0.092, z, shell, 0.005);
      }
    }
  }
  function ring(g: THREE.Group, x: number, y: number, z: number, radius: number, tube: number, mat: Surface, axis: 'x' | 'y' | 'z' = 'z') {
    const m = mesh(g, new THREE.TorusGeometry(radius, tube, 8, 32), mat);
    m.position.set(x, y, z);
    if (axis === 'x') m.rotation.y = Math.PI / 2;
    if (axis === 'y') m.rotation.x = Math.PI / 2;
    return m;
  }
  function knurl(g: THREE.Group, x: number, y: number, z: number, r: number, len: number, axis: 'x' | 'y' | 'z') {
    cyl(g, x, y, z, r, len, steel, axis, 32);
    for (let i = 0; i < 24; i++) {
      const a = i * Math.PI / 12;
      if (axis === 'y') cyl(g, x + Math.cos(a) * r, y, z + Math.sin(a) * r, 0.007, len * 0.82, edge, axis, 5);
      else if (axis === 'x') cyl(g, x, y + Math.cos(a) * r, z + Math.sin(a) * r, 0.006, len * 0.8, edge, axis, 5);
      else cyl(g, x + Math.cos(a) * r, y + Math.sin(a) * r, z, 0.006, len * 0.8, edge, axis, 5);
    }
  }

  // Broad receiver silhouette and its shallow, decorative surface relief.
  const body = slot('finish');
  shape(body, [[-0.84, 0.37], [-0.89, 0.77], [-0.72, 0.96], [0.92, 0.96],
    [1.13, 0.85], [1.19, 0.5], [1.02, 0.38]], 0.43, 0, shell, 0.038);
  shape(body, [[-0.89, 0.4], [1.18, 0.4], [1.18, 0.09], [0.98, -0.01],
    [0.81, -0.12], [0.34, -0.11], [0.15, -0.26], [0.06, -0.44],
    [-0.65, -0.44], [-0.8, -0.26]], 0.43, 0, shell, 0.028);
  shape(body, [[-0.69, -0.08], [0.09, -0.07], [0.085, -0.43], [-0.03, -0.51],
    [-0.71, -0.48], [-0.79, -0.36]], 0.48, 0, shell, 0.021);
  // Magwell bevel: a narrow contrasting rim makes the cast silhouette legible.
  shape(body, [[-0.72, -0.43], [0.085, -0.43], [0.06, -0.505], [-0.725, -0.50]], 0.495, 0, raised, 0.006);
  for (const s of [-1, 1]) {
    const z = s * 0.25;
    shape(body, [[-0.82, 0.30], [-0.66, 0.37], [0.87, 0.37], [1.06, 0.28],
      [0.83, 0.23], [-0.62, 0.24]], 0.02, z, raised, 0.007);
    pill(body, -0.07, 0.52, s * 0.246, 0.75, 0.24, dark, 0.018);
    shape(body, [[-0.46, 0.58], [0.30, 0.58], [0.29, 0.43], [-0.40, 0.41],
      [-0.48, 0.46]], 0.019, s * 0.271, steel, 0.009);
    line(body, new THREE.Vector3(-0.46, 0.423, s * 0.3), new THREE.Vector3(0.29, 0.423, s * 0.3), 0.012, edge);
    for (let i = 0; i < 4; i++) cyl(body, -0.39 + i * 0.195, 0.42, s * 0.298, 0.021, 0.055, steel, 'x', 12);
    shape(body, [[0.42, 0.52], [0.51, 0.70], [0.73, 0.72], [0.88, 0.58], [0.80, 0.4], [0.63, 0.42]], 0.06, s * 0.25, shell, 0.025);
    cyl(body, 0.89, 0.65, s * 0.29, 0.074, 0.105, steel, 'z', 20);
    cyl(body, 0.89, 0.65, s * 0.356, 0.063, 0.035, raised, 'z', 20);
    for (let j = 0; j < 5; j++) box(body, 0.864 + j * 0.013, 0.65, s * 0.379, 0.006, 0.062, 0.002, dark, 0);
    pin(body, -0.7, 0.21, s * 0.282, 0.05);
    pin(body, 0.87, 0.16, s * 0.269, 0.047);
    pin(body, 0.25, 0.02, s * 0.257, 0.027);
    pin(body, 0.67, 0.025, s * 0.257, 0.027);
    // External selector relief and a restrained red index dash.
    cyl(body, 0.93, 0.03, s * 0.27, 0.058, 0.026, steel);
    shape(body, [[0.92, 0.065], [1.095, 0.105], [1.12, 0.061], [0.93, -0.01]], 0.029, s * 0.29, steel, 0.01);
    mark(body, 1.075, 0.168, s * 0.278, 0.038, red);
    mark(body, 0.92, -0.062, s * 0.278, 0.021, white);
    // Raised magazine release and casting panel.
    box(body, -0.20, 0.095, s * 0.268, 0.19, 0.105, 0.025, steel, 0.016);
    for (let j = 0; j < 4; j++) box(body, -0.26 + j * 0.04, 0.095, s * 0.289, 0.009, 0.06, 0.006, edge, 0.001);
    shape(body, [[-0.60, -0.13], [-0.035, -0.13], [-0.02, -0.37], [-0.64, -0.35]], 0.008, s * 0.263, polymer, 0.015);
    // Tiny neutral display markings, intentionally unrelated to maker/serial data.
    for (let j = 0; j < 3; j++) mark(body, -0.32, -0.21 - j * 0.037, s * 0.277, 0.21 - j * 0.04);
    box(body, -0.56, -0.23, s * 0.278, 0.04, 0.07, 0.003, accent, 0.001);
  }
  rail(body, -0.77, 1.08, 1.015);
  // Separate, sculpted pistol-grip silhouette, with molded palm panels.
  shape(body, [[0.85, -0.06], [1.13, -0.09], [1.22, -0.31], [1.53, -1.12],
    [1.46, -1.27], [1.09, -1.33], [0.98, -1.2], [0.80, -0.53], [0.74, -0.22]], 0.34, 0, polymer, 0.055);
  for (const s of [-1, 1]) {
    shape(body, [[0.94, -0.36], [1.12, -0.39], [1.35, -1.1], [1.28, -1.16],
      [1.12, -1.13]], 0.012, s * 0.206, rubber, 0.015);
    for (let j = 0; j < 7; j++) {
      const y = -0.46 - j * 0.085, x = 1.04 + j * 0.025;
      line(body, new THREE.Vector3(x - 0.045, y, s * 0.225), new THREE.Vector3(x + 0.098, y - 0.015, s * 0.225), 0.008, polymer, 5);
    }
    pin(body, 1.25, -1.235, s * 0.199, 0.026);
  }
  shape(body, [[1.08, -1.27], [1.45, -1.22], [1.48, -1.30], [1.10, -1.36]], 0.37, 0, rubber, 0.013);
  // An open decorative guard, with no working mechanism represented.
  const guard = outline([[0.17, -0.115], [0.26, -0.48], [0.81, -0.51], [0.93, -0.21],
    [0.86, -0.16], [0.74, -0.41], [0.32, -0.4], [0.26, -0.1]]);
  shape(body, guard, 0.13, 0, steel, 0.014);
  shape(body, [[0.53, -0.13], [0.60, -0.12], [0.56, -0.31], [0.48, -0.35], [0.49, -0.30]], 0.057, 0, steel, 0.009);
  // Charging-handle outline / backplate visual seam.
  box(body, 1.17, 0.92, 0, 0.17, 0.08, 0.40, steel, 0.016);
  box(body, 1.16, 0.945, 0.31, 0.19, 0.06, 0.20, steel, 0.018);
  for (let i = 0; i < 4; i++) box(body, 1.095 + i * 0.041, 0.96, 0.38, 0.012, 0.05, 0.04, edge, 0.001);

  // Stock: common visual buffer-tube spine, fully capped and nonfunctional.
  const stock = slot('stock');
  cyl(stock, 1.82, 0.66, 0, 0.17, 1.48, steel, 'x', 24);
  cyl(stock, 1.30, 0.66, 0, 0.195, 0.14, dark, 'x', 24);
  cyl(stock, 1.365, 0.66, 0, 0.199, 0.09, shell, 'x', 24);
  for (let i = 0; i < 4; i++) ring(stock, 1.32 + i * 0.028, 0.66, 0, 0.19, 0.008, edge, 'x');
  if (config.stock === 'classic') {
    shape(stock, [[1.79, 0.87], [2.91, 0.90], [3.06, 0.79], [3.10, -0.14],
      [2.89, -0.29], [2.69, -0.23], [2.65, 0.12], [2.12, 0.25], [1.73, 0.35]], 0.43, 0, polymer, 0.043);
    for (const s of [-1, 1]) {
      shape(stock, [[1.88, 0.76], [2.92, 0.78], [2.9, 0.51], [2.25, 0.44], [1.87, 0.49]], 0.022, s * 0.262, shell, 0.018);
      shape(stock, [[2.19, 0.39], [2.81, 0.42], [2.82, 0.08], [2.67, 0.0], [2.55, 0.18]], 0.008, s * 0.263, dark, 0.013);
      shape(stock, [[2.3, 0.35], [2.70, 0.34], [2.74, 0.15], [2.59, 0.18]], 0.009, s * 0.275, steel, 0.008);
      pill(stock, 2.93, 0.31, s * 0.273, 0.073, 0.28, dark);
      pin(stock, 2.04, 0.60, s * 0.29, 0.034);
      for (let i = 0; i < 6; i++) box(stock, 2.81 + i * 0.035, 0.67, s * 0.291, 0.009, 0.12, 0.006, polymer, 0.001);
    }
    shape(stock, [[2.98, 0.91], [3.10, 0.84], [3.17, 0.69], [3.17, -0.13], [3.06, -0.30], [2.95, -0.29]], 0.50, 0, rubber, 0.036);
    shape(stock, [[1.94, 0.31], [2.66, 0.12], [2.62, -0.005], [2.12, 0.085]], 0.14, 0, steel, 0.014);
  } else if (config.stock === 'compact') {
    for (const s of [-1, 1]) {
      cyl(stock, 2.12, 0.55, s * 0.19, 0.036, 1.38, edge, 'x', 12);
      shape(stock, [[2.27, 0.87], [2.89, 0.86], [3.01, 0.68], [2.98, 0.40], [2.58, 0.36], [2.27, 0.46]], 0.042, s * 0.21, polymer, 0.025);
      pin(stock, 2.47, 0.59, s * 0.26, 0.038);
      pill(stock, 2.76, 0.60, s * 0.26, 0.21, 0.092, dark);
    }
    shape(stock, [[2.94, 0.79], [3.07, 0.72], [3.10, -0.08], [2.99, -0.22], [2.87, -0.17], [2.88, 0.54]], 0.40, 0, rubber, 0.04);
    box(stock, 2.37, 0.28, 0, 0.31, 0.10, 0.21, steel, 0.018);
  } else {
    shape(stock, [[1.81, 0.78], [2.91, 0.79], [3.04, 0.57], [3.06, -0.33], [2.90, -0.43],
      [2.63, -0.31], [2.55, -0.04], [1.93, 0.07], [1.75, 0.27]], 0.49, 0, polymer, 0.042);
    shape(stock, [[1.81, 0.78], [1.98, 1.02], [2.76, 1.02], [2.92, 0.80]], 0.53, 0, rubber, 0.044);
    for (const s of [-1, 1]) {
      shape(stock, [[1.99, 0.57], [2.70, 0.58], [2.84, 0.38], [2.80, 0.15], [2.01, 0.23]], 0.01, s * 0.293, shell, 0.02);
      pill(stock, 2.35, 0.37, s * 0.31, 0.39, 0.097, dark);
      knurl(stock, 2.62, 0.64, s * 0.30, 0.083, 0.078, 'z');
      pin(stock, 2.18, 0.10, s * 0.29, 0.041);
      pill(stock, 2.83, -0.06, s * 0.283, 0.065, 0.22, dark);
    }
    shape(stock, [[3.00, 0.83], [3.15, 0.76], [3.17, -0.32], [3.04, -0.45], [2.94, -0.39]], 0.55, 0, rubber, 0.036);
  }
  for (let i = 0; i < 10; i++) {
    const x = config.stock === 'compact' ? 3.085 : 3.164;
    box(stock, x, -0.08 + i * 0.075, 0, 0.013, 0.012, config.stock === 'compact' ? 0.32 : 0.42, steel, 0.002);
  }

  // Free-form handguard exterior. Cutouts are visual styling, not part drawings.
  const handguard = slot('handguard');
  cyl(handguard, -0.89, 0.66, 0, 0.30, 0.17, steel, 'x', 24);
  for (let i = 0; i < 4; i++) ring(handguard, -0.83 - i * 0.038, 0.66, 0, 0.286, 0.012, edge, 'x');
  if (config.handguard === 'quad') {
    shape(handguard, [[-2.79, 0.42], [-2.72, 0.91], [-0.97, 0.93], [-0.94, 0.39], [-1.04, 0.32], [-2.68, 0.32]], 0.52, 0, polymer, 0.035);
    rail(handguard, -2.71, -1.04, 1.015);
    for (const s of [-1, 1]) {
      rail(handguard, -2.66, -1.03, 0.64, s * 0.323, true);
      for (let j = 0; j < 8; j++) {
        pill(handguard, -2.59 + j * 0.209, 0.84, s * 0.295, 0.117, 0.054, dark);
        pill(handguard, -2.59 + j * 0.209, 0.425, s * 0.295, 0.117, 0.045, dark);
      }
      pin(handguard, -2.71, 0.61, s * 0.387, 0.037);
      pin(handguard, -1.04, 0.61, s * 0.387, 0.037);
    }
    rail(handguard, -2.65, -1.04, 0.31);
    // Soft ribbed rail cover occupies one short section, breaking up the teeth.
    for (const s of [-1, 1]) {
      box(handguard, -1.86, 0.635, s * 0.39, 0.72, 0.215, 0.053, rubber, 0.018);
      for (let j = 0; j < 8; j++) box(handguard, -2.17 + j * 0.089, 0.635, s * 0.427, 0.025, 0.195, 0.016, polymer, 0.005);
    }
    // The quad treatment carries a characteristic open, sculptural front tower.
    // It is a solid display accent, with no working components represented.
    const tower = outline([[-3.12, 0.58], [-3.11, 0.84], [-3.00, 1.35],
      [-2.88, 1.35], [-2.74, 0.82], [-2.74, 0.59]]);
    const window = new THREE.Path();
    window.moveTo(-3.005, 0.84); window.lineTo(-2.935, 1.16);
    window.lineTo(-2.841, 0.84); window.closePath(); tower.holes.push(window);
    shape(handguard, tower, 0.13, 0, steel, 0.017);
    cyl(handguard, -2.935, 0.665, 0, 0.156, 0.29, steel, 'x', 18);
    for (const s of [-1, 1]) {
      shape(handguard, [[-3.015, 1.30], [-2.87, 1.30], [-2.853, 1.47],
        [-2.893, 1.515], [-2.925, 1.41], [-2.991, 1.40]], 0.035, s * 0.090, steel, 0.009);
      pin(handguard, -2.92, 0.64, s * 0.164, 0.031);
    }
    cyl(handguard, -2.941, 1.365, 0, 0.015, 0.145, edge, 'y', 10);
  } else if (config.handguard === 'slim') {
    const panel = outline([[-2.86, 0.40], [-2.78, 0.91], [-0.99, 0.94], [-0.94, 0.36], [-2.73, 0.31]]);
    shape(handguard, panel, 0.39, 0, shell, 0.035);
    rail(handguard, -2.79, -1.03, 1.015);
    for (const s of [-1, 1]) {
      shape(handguard, [[-2.79, 0.49], [-1.02, 0.49], [-1.02, 0.81], [-2.73, 0.80]], 0.017, s * 0.243, shell, 0.012);
      for (let j = 0; j < 5; j++) {
        pill(handguard, -2.58 + j * 0.305, 0.65, s * 0.26, 0.226, 0.106, dark);
        pill(handguard, -2.58 + j * 0.305, 0.68, s * 0.267, 0.189, 0.016, edge);
        pill(handguard, -2.58 + j * 0.305, 0.407, s * 0.22, 0.19, 0.055, dark);
      }
      pin(handguard, -2.78, 0.51, s * 0.26, 0.035);
      pin(handguard, -1.02, 0.54, s * 0.26, 0.035);
      pin(handguard, -1.03, 0.78, s * 0.26, 0.035);
    }
    box(handguard, -1.87, 0.31, 0, 1.56, 0.05, 0.20, steel, 0.012);
  } else {
    for (const s of [-1, 1]) {
      const panel = outline([[-2.87, 0.43], [-2.76, 0.93], [-1.02, 0.96], [-0.94, 0.40], [-1.08, 0.31], [-2.75, 0.32]]);
      for (let j = 0; j < 4; j++) {
        const x = -2.66 + j * 0.402;
        const hole = new THREE.Path();
        hole.moveTo(x, 0.48); hole.lineTo(x + 0.055, 0.81); hole.lineTo(x + 0.29, 0.81);
        hole.lineTo(x + 0.25, 0.48); hole.closePath(); panel.holes.push(hole);
      }
      shape(handguard, panel, 0.048, s * 0.261, shell, 0.019);
      pin(handguard, -2.76, 0.47, s * 0.307, 0.031);
      pin(handguard, -1.04, 0.51, s * 0.307, 0.031);
      for (let j = 0; j < 3; j++) mark(handguard, -2.30 + j * 0.40, 0.38, s * 0.30, 0.11, accent);
    }
    box(handguard, -1.88, 0.355, 0, 1.85, 0.095, 0.46, steel, 0.015);
    box(handguard, -1.86, 0.913, 0, 1.77, 0.06, 0.42, shell, 0.01);
    cyl(handguard, -1.85, 0.665, 0, 0.103, 1.85, dark, 'x', 20);
    rail(handguard, -2.76, -1.02, 1.015);
  }
  // A few small indexing marks catch the top-edge light.
  for (let i = 0; i < 6; i++) mark(handguard, -2.58 + i * 0.258, 0.984, 0.19, 0.04, white);

  const muzzle = slot('muzzle');
  cyl(muzzle, -3.14, 0.665, 0, 0.104, 0.86, steel, 'x', 32);
  cyl(muzzle, -2.88, 0.665, 0, 0.135, 0.11, dark, 'x', 24);
  cyl(muzzle, -3.25, 0.665, 0, 0.12, 0.08, steel, 'x', 24);
  if (config.muzzle === 'standard') {
    cyl(muzzle, -3.60, 0.665, 0, 0.135, 0.43, steel, 'x', 16);
    cyl(muzzle, -3.37, 0.665, 0, 0.14, 0.045, edge, 'x', 12);
    ring(muzzle, -3.78, 0.665, 0, 0.116, 0.020, edge, 'x');
    // Shallow dark face and inset stripes; no bore or internal geometry.
    cyl(muzzle, -3.795, 0.665, 0, 0.093, 0.01, dark, 'x', 24);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      const m = box(muzzle, -3.61, 0, 0, 0.23, 0.028, 0.016, dark, 0.004);
      m.rotation.x = a;
      m.position.y = 0.665 + Math.cos(a) * 0.132;
      m.position.z = Math.sin(a) * 0.132;
    }
  } else {
    cyl(muzzle, -3.63, 0.665, 0, 0.205, 0.73, steel, 'x', 32);
    cyl(muzzle, -3.235, 0.665, 0, 0.163, 0.09, edge, 'x', 16);
    for (let i = 0; i < 5; i++) ring(muzzle, -3.91 + i * 0.137, 0.665, 0, 0.2, 0.008, edge, 'x');
    cyl(muzzle, -4.003, 0.665, 0, 0.181, 0.012, dark, 'x', 32);
    ring(muzzle, -4.015, 0.665, 0, 0.177, 0.024, steel, 'x');
    for (const s of [-1, 1]) {
      box(muzzle, -3.60, 0.67, s * 0.205, 0.27, 0.085, 0.002, dark, 0.004);
      for (let j = 0; j < 3; j++) mark(muzzle, -3.66, 0.686 - j * 0.018, s * 0.210, 0.13 - j * 0.027, white);
    }
  }

  // Magazine: stylized shallow pressed ribs, three visibly distinct silhouettes.
  const magazine = slot('magazine');
  const magLength = config.magazine === 'short' ? 0.62 : config.magazine === 'extended' ? 1.53 : 1.15;
  const magBottom = -0.41 - magLength;
  const curve = config.magazine === 'short' ? 0.02 : config.magazine === 'extended' ? 0.34 : 0.21;
  const magPoly = config.magazine === 'extended' ? polymer : steel;
  shape(magazine, [[-0.63, -0.30], [-0.015, -0.30], [-0.012, -0.77],
    [-0.02 - curve * 0.43, magBottom + 0.20], [-0.075 - curve, magBottom],
    [-0.67 - curve, magBottom + 0.09], [-0.66 - curve * 0.7, magBottom + 0.35], [-0.64, -0.73]], 0.34, 0, magPoly, 0.031);
  for (const s of [-1, 1]) {
    for (let j = 0; j < 4; j++) {
      const x = -0.53 + j * 0.13;
      const endX = x - curve * 0.88;
      shape(magazine, [[x - 0.022, -0.56], [x + 0.022, -0.56],
        [x + 0.020 - curve * 0.25, magBottom + 0.37], [endX + 0.02, magBottom + 0.18],
        [endX - 0.023, magBottom + 0.19], [x - 0.024 - curve * 0.25, magBottom + 0.37]], 0.012, s * 0.205, raised, 0.008);
    }
    if (config.magazine === 'extended') {
      for (let j = 0; j < 5; j++) {
        const y = -0.83 - j * 0.18, x = -0.34 - j * 0.052;
        box(magazine, x, y, s * 0.215, 0.48, 0.022, 0.014, rubber, 0.004);
      }
    }
    mark(magazine, -0.34 - curve, magBottom + 0.135, s * 0.207, 0.12, white);
  }
  shape(magazine, [[-0.69 - curve, magBottom + 0.10], [-0.055 - curve, magBottom + 0.015],
    [-0.060 - curve, magBottom - 0.055], [-0.70 - curve, magBottom + 0.02]], 0.40, 0, dark, 0.014);
  shape(magazine, [[-0.65, -0.39], [-0.012, -0.39], [-0.012, -0.47], [-0.65, -0.46]], 0.36, 0, dark, 0.007);

  const optic = slot('optic');
  function flipSight(x: number, height: number) {
    box(optic, x, 1.12, 0, 0.26, 0.09, 0.31, steel, 0.016);
    cyl(optic, x, 1.17, 0, 0.074, 0.39, steel, 'z', 16);
    for (const s of [-1, 1]) pin(optic, x, 1.17, s * 0.204, 0.039);
    for (const s of [-1, 1]) shape(optic, [[x - 0.084, 1.17], [x + 0.081, 1.17],
      [x + 0.105, 1.17 + height], [x + 0.053, 1.23 + height], [x - 0.075, 1.23 + height]], 0.045, s * 0.103, shell, 0.011);
    cyl(optic, x, 1.23 + height * 0.65, 0, 0.055, 0.037, steel, 'x', 20);
    ring(optic, x - 0.026, 1.23 + height * 0.65, 0, 0.030, 0.013, edge, 'x');
  }
  if (config.optic === 'iron') {
    flipSight(0.85, 0.27);
    flipSight(-2.52, 0.25);
  } else if (config.optic === 'reflex') {
    flipSight(0.87, 0.03);
    box(optic, 0.12, 1.13, 0, 0.61, 0.12, 0.34, steel, 0.014);
    shape(optic, [[-0.27, 1.18], [0.47, 1.18], [0.43, 1.33], [0.20, 1.44], [-0.24, 1.36]], 0.39, 0, polymer, 0.026);
    // Tall folded hood: two separate walls and a curved top cap.
    for (const s of [-1, 1]) {
      shape(optic, [[-0.29, 1.30], [-0.34, 1.70], [-0.24, 1.87], [0.11, 1.87],
        [0.25, 1.66], [0.22, 1.35]], 0.045, s * 0.237, steel, 0.023);
      shape(optic, [[-0.23, 1.41], [-0.25, 1.68], [-0.18, 1.78], [0.075, 1.77],
        [0.14, 1.64], [0.13, 1.4]], 0.010, s * 0.273, shell, 0.015);
      pin(optic, 0.20, 1.35, s * 0.281, 0.044);
    }
    box(optic, -0.04, 1.85, 0, 0.29, 0.08, 0.47, steel, 0.025);
    const lens = mesh(optic, new THREE.PlaneGeometry(0.37, 0.40), glass, 'reflex coated lens');
    lens.rotation.y = Math.PI / 2;
    lens.position.set(-0.22, 1.61, 0);
    box(optic, 0.36, 1.31, 0, 0.17, 0.145, 0.39, rubber, 0.019);
    for (const s of [-1, 1]) {
      cyl(optic, 0.35, 1.32, s * 0.22, 0.043, 0.025, dark);
      mark(optic, 0.35, 1.32, s * 0.237, 0.034, white);
      knurl(optic, -0.05, 1.33, s * 0.276, 0.065, 0.06, 'z');
    }
    const dot = mesh(optic, new THREE.SphereGeometry(0.011, 10, 8), glow);
    dot.position.set(-0.213, 1.62, 0);
  } else {
    for (const x of [-0.28, 0.40]) {
      box(optic, x, 1.13, 0, 0.23, 0.105, 0.36, steel, 0.01);
      shape(optic, [[x - 0.07, 1.17], [x + 0.07, 1.17], [x + 0.12, 1.47], [x - 0.12, 1.47]], 0.18, 0, steel, 0.018);
      ring(optic, x, 1.58, 0, 0.176, 0.034, shell, 'x');
      for (const s of [-1, 1]) pin(optic, x, 1.17, s * 0.205, 0.039);
    }
    cyl(optic, 0.08, 1.58, 0, 0.155, 1.20, steel, 'x', 36);
    cyl(optic, -0.82, 1.58, 0, 0.26, 0.46, polymer, 'x', 36);
    cyl(optic, -0.53, 1.58, 0, 0.16, 0.19, steel, 'x', 36, 0.255);
    ring(optic, -1.061, 1.58, 0, 0.245, 0.018, edge, 'x');
    cyl(optic, -1.067, 1.58, 0, 0.226, 0.009, glassDark, 'x', 40);
    cyl(optic, 0.83, 1.58, 0, 0.207, 0.31, polymer, 'x', 32);
    knurl(optic, 0.65, 1.58, 0, 0.187, 0.10, 'x');
    ring(optic, 0.99, 1.58, 0, 0.186, 0.022, rubber, 'x');
    cyl(optic, 0.985, 1.58, 0, 0.166, 0.01, glassDark, 'x', 36);
    knurl(optic, 0.06, 1.80, 0, 0.105, 0.12, 'y');
    cyl(optic, 0.06, 1.873, 0, 0.098, 0.026, steel, 'y', 24);
    knurl(optic, 0.06, 1.58, 0.20, 0.105, 0.13, 'z');
    for (let i = 0; i < 5; i++) mark(optic, -0.13 + i * 0.08, 1.60, 0.163, 0.025, white);
  }

  const foregrip = slot('foregrip');
  if (config.foregrip === 'vertical') {
    box(foregrip, -1.91, 0.27, 0, 0.43, 0.11, 0.35, steel, 0.018);
    shape(foregrip, [[-2.04, 0.20], [-1.79, 0.20], [-1.73, -0.61], [-1.80, -0.72],
      [-2.03, -0.69], [-2.07, -0.60]], 0.29, 0, polymer, 0.045);
    for (let j = 0; j < 7; j++) {
      const y = 0.03 - j * 0.088;
      ring(foregrip, -1.907 + j * 0.003, y, 0, 0.154, 0.012, rubber, 'y').scale.x = 0.83;
    }
    for (const s of [-1, 1]) pin(foregrip, -1.91, 0.245, s * 0.20, 0.043);
  } else if (config.foregrip === 'angled') {
    box(foregrip, -1.98, 0.27, 0, 0.91, 0.11, 0.32, steel, 0.014);
    const grip = outline([[-2.43, 0.23], [-1.55, 0.23], [-1.53, -0.16], [-1.64, -0.24],
      [-2.15, -0.15], [-2.40, 0.02]]);
    const hole = new THREE.Path();
    hole.moveTo(-2.17, 0.11); hole.lineTo(-1.72, 0.11); hole.lineTo(-1.72, -0.06); hole.lineTo(-2.12, -0.035); hole.closePath();
    grip.holes.push(hole);
    shape(foregrip, grip, 0.27, 0, polymer, 0.025);
    for (const s of [-1, 1]) {
      pin(foregrip, -2.29, 0.18, s * 0.182, 0.031);
      pin(foregrip, -1.69, 0.18, s * 0.182, 0.031);
      for (let j = 0; j < 5; j++) line(foregrip,
        new THREE.Vector3(-2.09 + j * 0.084, -0.135 - j * 0.012, s * 0.17),
        new THREE.Vector3(-2.10 + j * 0.084, -0.082 - j * 0.011, s * 0.17), 0.009, rubber, 5);
    }
  }

  if (config.detail === 'worn') {
    // Sparse authored scuffs; no random sparkling noise across large flat faces.
    for (const s of [-1, 1]) {
      for (let i = 0; i < 18; i++) {
        const x = -0.72 + i * 0.098, y = 0.865 + Math.sin(i * 1.7) * 0.018;
        line(body, new THREE.Vector3(x, y, s * 0.253), new THREE.Vector3(x + 0.035 + (i % 3) * 0.015, y + 0.006, s * 0.253), 0.0025, edge, 4);
      }
      for (let i = 0; i < 8; i++) mark(body, -0.62 + i * 0.079, -0.44 + (i % 2) * 0.009, s * 0.282, 0.028, edge);
      for (let i = 0; i < 6; i++) mark(handguard, -2.59 + i * 0.27, 0.905, s * 0.294, 0.035, accent);
      for (let i = 0; i < 4; i++) mark(magazine, -0.54 - curve + i * 0.115, magBottom + 0.065, s * 0.214, 0.035, edge);
    }
  }

  for (const child of root.children) if (child instanceof THREE.Group) batchSlot(child);
  // Place the visual center near the origin; preserve Y=0 as the receiver baseline.
  root.position.x = 0.34;
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  root.userData.bounds = { min: bounds.min.toArray(), max: bounds.max.toArray() };
  let drawCalls = 0, triangles = 0;
  root.traverse(obj => {
    if (obj instanceof THREE.Mesh) {
      drawCalls++;
      triangles += (obj.geometry.index?.count ?? obj.geometry.getAttribute('position').count) / 3;
    }
  });
  root.userData.stats = { drawCalls, triangles };
  root.userData.camera = { position: [5.7, 3.0, 9.4], target: [-0.10, 0.12, 0], fov: 34 };
  return root;
}

/** Dispose the asset after replacing it with another configuration. */
export function disposeM4Model(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(obj => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.geometry.dispose();
    const list = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of list) materials.add(m);
  });
  materials.forEach(m => {
    for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value);
    m.dispose();
  });
  textures.forEach(t => t.dispose());
  root.removeFromParent();
}

export default createM4Model;
