import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { AssetReport } from './model-assets';

/** Keep supplied geometry, UVs, normals and PBR channels. Normalize for display only. */
export async function loadDisplayAsset(url: string, anisotropy: number) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = new THREE.Group();
  root.name = 'M4A1 artist asset';
  gltf.scene.rotation.y += Math.PI / 2;
  root.add(gltf.scene);
  try {
    // Static art groups can parent other meshes in the FBX. Give each visible
    // mesh an independent display node so hiding one does not hide its siblings.
    root.updateMatrixWorld(true);
    const displayMeshes: THREE.Mesh[] = [];
    root.traverse(object => { if (object instanceof THREE.Mesh) displayMeshes.push(object); });
    displayMeshes.forEach(mesh => root.attach(mesh));
    const report = inspectAsset(root, anisotropy);
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3());
    const longest = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(longest) || longest <= 0 || report.meshes === 0) throw new Error('The model has no displayable geometry.');
    root.scale.setScalar(7.4 / longest);
    root.updateMatrixWorld(true);
    const center = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
    root.position.sub(center);
    root.updateMatrixWorld(true);
    return { root, report };
  } catch (error) {
    disposeDisplayAsset(root);
    throw error;
  }
}

export function inspectAsset(root: THREE.Object3D, anisotropy = 1): AssetReport {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const report: AssetReport = { meshes: 0, triangles: 0, materials: 0, textures: 0, textureSize: 0, nodes: [] };
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const positions = object.geometry.getAttribute('position');
    if (!positions || !Array.from(positions.array).every(Number.isFinite)) throw new Error('The model contains invalid vertices.');
    object.castShadow = true;
    object.receiveShadow = true;
    object.userData.assetPart = object.name;
    report.meshes++;
    report.triangles += (object.geometry.index?.count ?? positions.count) / 3;
    report.nodes.push(object.name || 'Unnamed mesh');
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (!(value instanceof THREE.Texture)) continue;
        textures.add(value);
        value.anisotropy = Math.min(8, anisotropy);
        const image = value.image as { width?: number; height?: number } | undefined;
        report.textureSize = Math.max(report.textureSize, image?.width ?? 0, image?.height ?? 0);
      }
    }
  });
  report.materials = materials.size;
  report.textures = textures.size;
  return report;
}

export function disposeDisplayAsset(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const bitmaps = new Set<ImageBitmap>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (!(value instanceof THREE.Texture)) continue;
        textures.add(value);
        if (typeof ImageBitmap !== 'undefined' && value.image instanceof ImageBitmap) bitmaps.add(value.image);
      }
    }
  });
  root.removeFromParent();
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  textures.forEach(texture => texture.dispose());
  bitmaps.forEach(bitmap => bitmap.close());
}
