import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BASE_MODEL_PARTS } from './model-assets';
import type { AssetAppearance } from './asset-appearance';
import { disposeDisplayAsset } from './gltf-model';
import { VARIANTS, VARIANT_BUNDLES, VARIANT_CATEGORIES } from './variant-catalogue';

/** Accessory art shares the base export's coordinates. Preserve nested animation nodes. */
export function attachVariantBundle(root: THREE.Group, scene: THREE.Group, bundle: number, anisotropy: number) {
  const variants = VARIANTS.filter(v => v.bundle === bundle);
  const groups = variants.map(v => {
    const group = scene.getObjectByName(v.root);
    if (!group) throw new Error('Missing accessory group: ' + v.root);
    let meshes = 0;
    group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      meshes++;
      const positions = object.geometry.getAttribute('position');
      if (!positions || !Array.from(positions.array).every(Number.isFinite)) throw new Error('Invalid accessory vertices.');
    });
    if (!meshes) throw new Error('Empty accessory group.');
    return group;
  });
  if (bundle === 0 && !scene.getObjectByName('G33_Pivot')) throw new Error('Missing magnifier pivot.');
  scene.rotation.y += Math.PI / 2;
  root.add(scene);
  root.updateMatrixWorld(true);
  groups.forEach((group,index) => {
    const variant = variants[index];
    const part = VARIANT_CATEGORIES.find(c => c.id === variant.category)!.part;
    // Move only the top-level accessory. Children keep their local pivots and transforms.
    root.attach(group);
    group.userData.displayPiece = true;
    group.userData.assetPart = part;
    group.userData.variantId = variant.id;
    group.visible = false;
    group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.userData.assetPart = part;
      object.castShadow = true;
      object.receiveShadow = true;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.anisotropy = Math.min(8, anisotropy);
      }
    });
  });
  return variants.map(v => v.id);
}

export function createVariantController(root: THREE.Group, available: readonly string[]) {
  const originals = BASE_MODEL_PARTS.map(p => root.getObjectByName(p.id)).filter((p): p is THREE.Object3D => !!p);
  const groups = VARIANTS.filter(v => available.includes(v.id)).map(v => ({ definition: v, group: root.getObjectByName(v.root)! }));
  const pivot = root.getObjectByName('G33_Pivot');
  const rest = pivot?.rotation.z ?? 0;
  return {
    available: [...available],
    apply(appearance: AssetAppearance) {
      const replaced = new Set<string>();
      for (const { definition, group } of groups) {
        const selected = appearance.variants?.[definition.category] === definition.id;
        if (selected) definition.replaces.forEach(id => replaced.add(id));
        group.visible = selected && !appearance.hiddenParts.includes(String(group.userData.assetPart));
      }
      for (const original of originals) original.visible = !replaced.has(original.name) && !appearance.hiddenParts.includes(original.name);
      root.updateMatrixWorld(true);
    },
    flip(amount: number) {
      if (pivot) pivot.rotation.z = rest - Math.PI / 2 * THREE.MathUtils.clamp(amount, 0, 1);
    },
  };
}

export async function loadAccessoryLibrary(root: THREE.Group, anisotropy: number, urls: readonly string[] = VARIANT_BUNDLES) {
  const results = await Promise.allSettled(urls.map(url => new GLTFLoader().loadAsync(url)));
  const available: string[] = [];
  let failed = 0;
  results.forEach((result,index) => {
    if (result.status === 'rejected') { failed++; return; }
    try { available.push(...attachVariantBundle(root,result.value.scene,index,anisotropy)); }
    catch { failed++; disposeDisplayAsset(result.value.scene); }
  });
  return { controller: createVariantController(root,available), warning: failed ? 'Some accessory artwork could not load. Original parts remain available; reload the model to retry.' : undefined };
}
