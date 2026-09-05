import * as THREE from 'three';
import { FINISHES, type AssetAppearance } from './asset-appearance';
import { prepareSurfaceGeometry } from './surface-geometry';
import { resolveSurfaceRecipe, type SurfaceRecipe } from './surface-recipes';

export function isProtectedSurface(object: THREE.Object3D, material: THREE.Material) {
  return !(material instanceof THREE.MeshStandardMaterial) || object.userData.keepMaterial === true
    || material.userData.keepMaterial === true || material.transparent
    || (material instanceof THREE.MeshPhysicalMaterial && material.transmission > 0)
    || material.emissiveIntensity > 0 && material.emissive.getHex() !== 0;
}

export function surfaceKind(object: THREE.Object3D, material: THREE.Material) {
  return resolveSurfaceRecipe(object, material).kind;
}
const WEAR = { factory: 0, handled: .38, weathered: .85 };

function copySurfaceMaterial(material: THREE.Material, recipe: SurfaceRecipe) {
  let copy = material.clone();
  if (!(material instanceof THREE.MeshStandardMaterial)) return copy;
  if (recipe.kind === 'glass') {
    copy.dispose();
    const glass = new THREE.MeshPhysicalMaterial();
    THREE.MeshStandardMaterial.prototype.copy.call(glass, material);
    glass.defines = { STANDARD: '', PHYSICAL: '' };
    const hws = recipe.id === 'glass-hws', magnifier = recipe.id === 'glass-magnifier';
    glass.color.set(hws ? '#dce8e2' : magnifier ? '#d9deed' : '#e8eceb');
    glass.metalness = 0; glass.roughness = recipe.roughness[0];
    glass.ior = 1.5; glass.specularIntensity = hws ? .32 : magnifier ? .46 : .75;
    glass.iridescence = magnifier ? .12 : 0;
    glass.iridescenceThicknessRange = [180, 220];
    glass.transparent = true; glass.opacity = hws ? .24 : magnifier ? .34 : .42;
    glass.depthWrite = false; glass.transmission = 0;
    glass.normalMap = null; glass.roughnessMap = null; glass.metalnessMap = null;
    copy = glass;
  } else if (copy instanceof THREE.MeshStandardMaterial && recipe.kind !== 'marking') {
    if (!recipe.preserveAtlas) {
      if (recipe.color) copy.color.set(recipe.color);
      copy.metalness = recipe.metalness;
      copy.roughness = (recipe.roughness[0] + recipe.roughness[1]) / 2;
    }
    copy.normalScale.multiplyScalar(recipe.normalStrength);
  }
  copy.userData.surfaceKind = recipe.kind;
  copy.userData.surfaceRecipe = recipe.id;
  return copy;
}

const FRAGMENT_DECLARATIONS = /* glsl */`
uniform float armoryCoating;
uniform vec3 armoryTint;
uniform float armoryWear;
uniform float armoryHasDetail;
uniform sampler2D armoryDetail;
uniform vec4 armoryResponse;
uniform float armoryDielectric;
uniform float armoryPreserveAtlas;
uniform vec4 armoryTextureResponse;
uniform vec4 armoryWearResponse;
uniform vec3 armorySubstrate;
uniform float armoryPattern;
varying vec3 vArmoryPosition;
varying vec3 vArmoryDirection;
varying vec3 vArmoryEdgeDistance;
varying vec3 vArmoryEdgeDistanceB;

vec4 armorySurfaceData(vec3 p, vec3 weights) {
  vec4 a = texture2D(armoryDetail, p.yz);
  vec4 b = texture2D(armoryDetail, p.zx);
  vec4 c = texture2D(armoryDetail, p.xy);
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
  vec3 armoryUV = vArmoryPosition * armoryTextureResponse.x;
  vec4 armoryData = mix(vec4(.5, 0.0, .5, .5), armorySurfaceData(armoryUV, armoryWeights), armoryHasDetail);
  float armoryPixel = max(length(dFdx(armoryUV)), length(dFdy(armoryUV))) * 512.0;
  float armoryDetailFade = 1.0 - smoothstep(.7, 3.5, armoryPixel);
  float armoryPatternFade = 1.0 - smoothstep(.5, 1.4, armoryPixel / 64.0);
  float armoryEdge = min(vArmoryEdgeDistance.x, min(vArmoryEdgeDistance.y, vArmoryEdgeDistance.z));
  armoryEdge = min(armoryEdge, min(vArmoryEdgeDistanceB.x, min(vArmoryEdgeDistanceB.y, vArmoryEdgeDistanceB.z)));
  float armoryWidth = mix(.00045, .0032, armoryWear);
  float armoryEdgeAA = max(fwidth(armoryEdge), .00008);
  float armoryEdgeMask = 1.0 - smoothstep(max(0.0, armoryWidth - armoryEdgeAA), armoryWidth + armoryEdgeAA, armoryEdge);
  float armoryBrokenEdge = smoothstep(.43, .69, armoryData.b);
  float armoryScratch = armoryData.g * armoryDetailFade;
  float armoryScuff = clamp(armoryWear * (armoryEdgeMask * armoryBrokenEdge * armoryWearResponse.x + armoryScratch * armoryTextureResponse.z), 0.0, 1.0);
  float artLuminance = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722));
  vec3 coatingAlbedo = armoryTint * (.55 + .45 * clamp(artLuminance * 2.0, 0.0, 1.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, coatingAlbedo, armoryCoating);
  diffuseColor.rgb *= 1.0 + (armoryData.b - .5) * armoryTextureResponse.w;
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
      const recipe = resolveSurfaceRecipe(object, material);
      const copy = copySurfaceMaterial(material, recipe);
      if (!(copy instanceof THREE.MeshStandardMaterial) || isProtectedSurface(object, material) || ['glass', 'marking', 'recess'].includes(recipe.kind)) return copy;
      const kind = recipe.kind;
      copy.dithering = true;
      const dielectric = ['polymer', 'rubber', 'coated'].includes(kind) ? 1 : 0;
      const enabled = { value: 0 }, tint = { value: new THREE.Color(0xffffff) }, wear = { value: WEAR.handled };
      copy.onBeforeCompile = shader => {
        shader.uniforms.armoryCoating = enabled;
        shader.uniforms.armoryTint = tint;
        shader.uniforms.armoryWear = wear;
        shader.uniforms.armoryDetail = { value: detail ?? null };
        shader.uniforms.armoryHasDetail = { value: detail ? 1 : 0 };
        shader.uniforms.armoryResponse = { value: new THREE.Vector4(...recipe.roughness, recipe.microHeight, ['polymer', 'rubber'].includes(kind) ? 0 : 1) };
        shader.uniforms.armoryDielectric = { value: dielectric };
        shader.uniforms.armoryPreserveAtlas = { value: recipe.preserveAtlas ? 1 : 0 };
        shader.uniforms.armoryTextureResponse = { value: new THREE.Vector4(recipe.density, recipe.variation, recipe.scratches, .035) };
        shader.uniforms.armoryWearResponse = { value: new THREE.Vector4(recipe.edgeWear, recipe.polish, recipe.wornRoughness, .018) };
        shader.uniforms.armorySubstrate = { value: new THREE.Vector3(...recipe.substrate) };
        shader.uniforms.armoryPattern = { value: recipe.pattern };
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
          .replace('#include <metalnessmap_fragment>', `
            #include <metalnessmap_fragment>
            // Preserve mixed source-atlas regions when the mesh contains several substances.
            float armoryMetalMask = mix(armoryResponse.w, metalnessFactor, armoryPreserveAtlas);
            float armoryReveal = armoryScuff * armoryMetalMask;
            diffuseColor.rgb = mix(diffuseColor.rgb, armorySubstrate, armoryReveal);
            diffuseColor.rgb += (1.0 - armoryMetalMask) * armoryScuff * armoryWearResponse.w;
            roughnessFactor = mix(roughnessFactor, clamp(roughnessFactor, armoryResponse.x, armoryResponse.y), mix(.90, .45, armoryPreserveAtlas));
            roughnessFactor = mix(roughnessFactor, clamp(roughnessFactor, .50, .78), armoryCoating);
            roughnessFactor += (armoryData.b - .5) * armoryTextureResponse.y;
            roughnessFactor = mix(roughnessFactor, armoryWearResponse.z, armoryReveal);
            float armoryContact = max(armoryScuff, armoryPattern * armoryWear * .22 * smoothstep(.53, .62, armoryData.a));
            roughnessFactor -= (1.0 - armoryMetalMask) * armoryContact * armoryWearResponse.y;
            roughnessFactor += armoryScratch * armoryWear * .08;
            // Unresolved micro detail contributes roughness rather than sparkling normals.
            roughnessFactor = sqrt(clamp(roughnessFactor * roughnessFactor + (1.0 - armoryDetailFade) * .012 * armoryHasDetail, .04, .96));
            metalnessFactor = mix(metalnessFactor, 0.0, max(armoryCoating, armoryDielectric * (1.0 - armoryPreserveAtlas)));
            metalnessFactor = mix(metalnessFactor, .95, armoryReveal);
          `).replace('#include <normal_fragment_maps>', `
            #include <normal_fragment_maps>
            float armoryGrainHeight = (armoryData.r - .5) * armoryDetailFade * mix(1.0, .18, armoryPattern);
            float armoryPatternHeight = armoryPattern * (armoryData.a - .5) * armoryPatternFade * 3.0;
            float armoryHeight = (armoryGrainHeight + armoryPatternHeight - armoryData.g * armoryWear * armoryTextureResponse.z * armoryDetailFade) * armoryResponse.z;
            normal = armoryBump(normal, armoryHeight, faceDirection);
          `);
      };
      copy.customProgramCacheKey = () => 'armory-part-surfaces-v3';
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
