import * as THREE from 'three';
import { FINISHES, type AssetAppearance } from './asset-appearance';
import { prepareSurfaceGeometry } from './surface-geometry';

export function isProtectedSurface(object: THREE.Object3D, material: THREE.Material) {
  return !(material instanceof THREE.MeshStandardMaterial) || object.userData.keepMaterial === true
    || material.userData.keepMaterial === true || material.transparent
    || (material instanceof THREE.MeshPhysicalMaterial && material.transmission > 0)
    || material.emissiveIntensity > 0 && material.emissive.getHex() !== 0;
}

export type SurfaceKind = 'authored' | 'anodized' | 'coated' | 'polymer' | 'rubber' | 'metal';
/** Material identity takes priority over the part: stocks also contain rubber and metal. */
export function surfaceKind(object: THREE.Object3D, material: THREE.Material): SurfaceKind {
  const name = material.name.toLowerCase();
  if (/rubber|gasket/.test(name)) return 'rubber';
  if (/polymer|molded/.test(name)) return 'polymer';
  if (/hardware|head finish/.test(name)) return 'metal';
  if (/ceramic/.test(name)) return 'coated';
  if (/anodized|cap metal|earth edge/.test(name)) return 'anodized';
  if (['Stock', 'Pistol_Grip'].includes(String(object.userData.assetPart))) return 'polymer';
  return 'authored';
}

const PROFILES: Record<SurfaceKind, [number, number, number, number]> = {
  authored: [.24, .88, .000075, 1],
  anodized: [.30, .70, .00009, 1],
  coated: [.43, .78, .00011, 1],
  polymer: [.44, .88, .00016, 0],
  rubber: [.68, .96, .00020, 0],
  metal: [.24, .63, .000055, 1],
};
const WEAR = { factory: 0, handled: .38, weathered: .85 };

const FRAGMENT_DECLARATIONS = /* glsl */`
uniform float armoryCoating;
uniform vec3 armoryTint;
uniform float armoryWear;
uniform float armoryHasDetail;
uniform sampler2D armoryDetail;
uniform vec4 armoryResponse;
uniform float armoryDielectric;
varying vec3 vArmoryPosition;
varying vec3 vArmoryDirection;
varying vec3 vArmoryEdgeDistance;
varying vec3 vArmoryEdgeDistanceB;

vec3 armorySurfaceData(vec3 p, vec3 weights) {
  vec3 a = texture2D(armoryDetail, p.yz).rgb;
  vec3 b = texture2D(armoryDetail, p.zx).rgb;
  vec3 c = texture2D(armoryDetail, p.xy).rgb;
  return a * weights.x + b * weights.y + c * weights.z;
}

// Surface-gradient bump layered AFTER the artist's normal map, in view space.
vec3 armoryBump(vec3 surfaceNormal, float height, float faceDirection) {
  vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
  vec3 rx = cross(sy, surfaceNormal), ry = cross(surfaceNormal, sx);
  float determinant = dot(sx, rx) * faceDirection;
  vec3 gradient = sign(determinant) * (dFdx(height) * rx + dFdy(height) * ry);
  return normalize(max(abs(determinant), 1e-10) * surfaceNormal - gradient);
}
`;

const SURFACE_SAMPLE = /* glsl */`
  #include <map_fragment>
  vec3 armoryWeights = pow(abs(normalize(vArmoryDirection)), vec3(4.0));
  armoryWeights /= max(dot(armoryWeights, vec3(1.0)), .0001);
  vec3 armoryUV = vArmoryPosition * 3.2;
  vec3 armoryData = mix(vec3(.5, 0.0, .5), armorySurfaceData(armoryUV, armoryWeights), armoryHasDetail);
  float armoryPixel = max(length(dFdx(armoryUV)), length(dFdy(armoryUV))) * 512.0;
  float armoryDetailFade = 1.0 - smoothstep(.7, 3.5, armoryPixel);
  float armoryEdge = min(vArmoryEdgeDistance.x, min(vArmoryEdgeDistance.y, vArmoryEdgeDistance.z));
  armoryEdge = min(armoryEdge, min(vArmoryEdgeDistanceB.x, min(vArmoryEdgeDistanceB.y, vArmoryEdgeDistanceB.z)));
  float armoryWidth = mix(.00045, .0032, armoryWear);
  float armoryEdgeAA = max(fwidth(armoryEdge), .00008);
  float armoryEdgeMask = 1.0 - smoothstep(max(0.0, armoryWidth - armoryEdgeAA), armoryWidth + armoryEdgeAA, armoryEdge);
  float armoryBrokenEdge = smoothstep(.43, .69, armoryData.b);
  float armoryScratch = armoryData.g * armoryDetailFade;
  float armoryScuff = clamp(armoryWear * (armoryEdgeMask * armoryBrokenEdge + armoryScratch * .48), 0.0, 1.0);
  float armoryReveal = armoryScuff * armoryResponse.w;
  float artLuminance = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722));
  vec3 coatingAlbedo = armoryTint * (.55 + .45 * clamp(artLuminance * 2.0, 0.0, 1.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, coatingAlbedo, armoryCoating);
  diffuseColor.rgb *= 1.0 + (armoryData.b - .5) * .045;
  // Coordinated coating loss: exposed metal is reflective, polymer abrasion stays plastic.
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.55, .57, .59), armoryReveal * .72);
  diffuseColor.rgb += (1.0 - armoryResponse.w) * armoryScuff * .018;
`;

/** Three retains its BRDF, authored texture channels, AO, shadows and color management. */
export function prepareAssetMaterials(root: THREE.Object3D, detail?: THREE.Texture) {
  const sourceMaterials = new Set<THREE.Material>();
  const sourceGeometries = new Set<THREE.BufferGeometry>();
  const surfaces: { id: string; enabled: { value: number }; tint: { value: THREE.Color }; wear: { value: number } }[] = [];
  root.updateMatrixWorld(true);
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const source = Array.isArray(object.material) ? object.material : [object.material];
    if (source.some(material => !isProtectedSurface(object, material))) {
      sourceGeometries.add(object.geometry);
      object.geometry = prepareSurfaceGeometry(object);
    }
    const copies = source.map(material => {
      sourceMaterials.add(material);
      const copy = material.clone();
      if (!(copy instanceof THREE.MeshStandardMaterial) || isProtectedSurface(object, material)) return copy;
      const kind = surfaceKind(object, material);
      copy.userData.surfaceKind = kind;
      copy.dithering = true;
      const dielectric = ['polymer', 'rubber', 'coated'].includes(kind) ? 1 : 0;
      const enabled = { value: 0 }, tint = { value: new THREE.Color(0xffffff) }, wear = { value: WEAR.handled };
      copy.onBeforeCompile = shader => {
        shader.uniforms.armoryCoating = enabled;
        shader.uniforms.armoryTint = tint;
        shader.uniforms.armoryWear = wear;
        shader.uniforms.armoryDetail = { value: detail ?? null };
        shader.uniforms.armoryHasDetail = { value: detail ? 1 : 0 };
        shader.uniforms.armoryResponse = { value: new THREE.Vector4(...PROFILES[kind]) };
        shader.uniforms.armoryDielectric = { value: dielectric };
        shader.vertexShader = `attribute vec3 armoryPosition;
          attribute vec3 armoryDirection;
          attribute vec3 armoryEdgeDistance;
          attribute vec3 armoryEdgeDistanceB;
          varying vec3 vArmoryPosition;
          varying vec3 vArmoryDirection;
          varying vec3 vArmoryEdgeDistance;
          varying vec3 vArmoryEdgeDistanceB;
        ` + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
          #include <begin_vertex>
          vArmoryPosition = armoryPosition;
          vArmoryDirection = armoryDirection;
          vArmoryEdgeDistance = armoryEdgeDistance;
          vArmoryEdgeDistanceB = armoryEdgeDistanceB;
        `);
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + FRAGMENT_DECLARATIONS);
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', SURFACE_SAMPLE)
          .replace('#include <roughnessmap_fragment>', `
            #include <roughnessmap_fragment>
            roughnessFactor = mix(roughnessFactor, clamp(roughnessFactor, armoryResponse.x, armoryResponse.y), .75);
            roughnessFactor = mix(roughnessFactor, clamp(roughnessFactor, .50, .78), armoryCoating);
            roughnessFactor += (armoryData.b - .5) * .16;
            roughnessFactor = mix(roughnessFactor, .32, armoryReveal * .68);
            roughnessFactor -= (1.0 - armoryResponse.w) * armoryScuff * .10;
            roughnessFactor += armoryScratch * armoryWear * .08;
            // Unresolved micro detail contributes roughness rather than sparkling normals.
            roughnessFactor = sqrt(clamp(roughnessFactor * roughnessFactor + (1.0 - armoryDetailFade) * .012 * armoryHasDetail, .04, .96));
          `).replace('#include <metalnessmap_fragment>', `
            #include <metalnessmap_fragment>
            metalnessFactor = mix(metalnessFactor, 0.0, max(armoryCoating, armoryDielectric));
            metalnessFactor = mix(metalnessFactor, .95, armoryReveal);
          `).replace('#include <normal_fragment_maps>', `
            #include <normal_fragment_maps>
            float armoryHeight = ((armoryData.r - .5) - armoryData.g * armoryWear * .65) * armoryResponse.z * armoryDetailFade;
            normal = armoryBump(normal, armoryHeight, faceDirection);
          `);
      };
      copy.customProgramCacheKey = () => 'armory-surface-v2';
      surfaces.push({ id: String(object.userData.assetPart), enabled, tint, wear });
      return copy;
    });
    object.material = Array.isArray(object.material) ? copies : copies[0];
  });
  // Maps stay shared; the caller owns the shared detail texture and its disposal.
  sourceMaterials.forEach(material => material.dispose());
  const retainedGeometry = new Set<THREE.BufferGeometry>();
  root.traverse(object => { if (object instanceof THREE.Mesh) retainedGeometry.add(object.geometry); });
  sourceGeometries.forEach(geometry => { if (!retainedGeometry.has(geometry)) geometry.dispose(); });
  return {
    apply(appearance: AssetAppearance) {
      for (const surface of surfaces) {
        const finish = FINISHES.find(f => f.id === (appearance.finishes[surface.id] ?? 'original')) ?? FINISHES[0];
        surface.enabled.value = finish.id === 'original' ? 0 : 1;
        surface.tint.value.set(finish.color);
        surface.wear.value = WEAR[appearance.wear ?? 'handled'];
      }
    },
  };
}
