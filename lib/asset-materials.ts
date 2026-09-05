import * as THREE from 'three';
import { FINISHES, type AssetAppearance } from './asset-appearance';

export function isProtectedSurface(object: THREE.Object3D, material: THREE.Material) {
  return !(material instanceof THREE.MeshStandardMaterial) || object.userData.keepMaterial === true
    || material.userData.keepMaterial === true || material.transparent
    || (material instanceof THREE.MeshPhysicalMaterial && material.transmission > 0)
    || material.emissiveIntensity > 0 && material.emissive.getHex() !== 0;
}

/** Cosmetic coating on top of the art texture. Original leaves source PBR untouched. */
export function prepareAssetMaterials(root: THREE.Object3D) {
  const sourceMaterials = new Set<THREE.Material>();
  const surfaces: { id: string; enabled: { value: number }; tint: { value: THREE.Color } }[] = [];
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const source = Array.isArray(object.material) ? object.material : [object.material];
    const copies = source.map(material => {
      sourceMaterials.add(material);
      const copy = material.clone();
      if (!(copy instanceof THREE.MeshStandardMaterial) || isProtectedSurface(object,material)) return copy;
      const enabled = { value: 0 }, tint = { value: new THREE.Color(0xffffff) };
      copy.onBeforeCompile = shader => {
        shader.uniforms.armoryCoating = enabled;
        shader.uniforms.armoryTint = tint;
        shader.fragmentShader = 'uniform float armoryCoating;\nuniform vec3 armoryTint;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
          #include <map_fragment>
          float artLuminance = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          vec3 coatingAlbedo = armoryTint * (0.55 + 0.45 * clamp(artLuminance * 2.0, 0.0, 1.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, coatingAlbedo, armoryCoating);
        `).replace('#include <roughnessmap_fragment>', `
          #include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, clamp(roughnessFactor, 0.50, 0.85), armoryCoating);
        `).replace('#include <metalnessmap_fragment>', `
          #include <metalnessmap_fragment>
          metalnessFactor = mix(metalnessFactor, 0.0, armoryCoating);
        `);
      };
      copy.customProgramCacheKey = () => 'armory-cosmetic-coating-v1';
      surfaces.push({ id: String(object.userData.assetPart), enabled, tint });
      return copy;
    });
    object.material = Array.isArray(object.material) ? copies : copies[0];
  });
  // Maps stay shared across per-part materials and are released by model cleanup.
  sourceMaterials.forEach(material => material.dispose());
  return {
    apply(appearance: AssetAppearance) {
      for (const surface of surfaces) {
        const finish = FINISHES.find(f => f.id === (appearance.finishes[surface.id] ?? 'original'))!;
        surface.enabled.value = finish.id === 'original' ? 0 : 1;
        surface.tint.value.set(finish.color);
      }
    },
  };
}
