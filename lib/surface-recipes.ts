import type { Material, Object3D } from 'three';

export type SurfaceKind = 'authored' | 'anodized' | 'coated' | 'polymer' | 'rubber' | 'metal' | 'glass' | 'marking' | 'recess';
export type SurfaceRecipe = {
  id: string; kind: SurfaceKind; roughness: [number, number]; metalness: number;
  microHeight: number; density: number; variation: number; scratches: number;
  edgeWear: number; polish: number; wornRoughness: number; substrate: [number, number, number];
  color?: string; preserveAtlas: boolean; normalStrength: number; pattern: number;
};
function recipe(id: string, kind: SurfaceKind, values: Partial<SurfaceRecipe> = {}): SurfaceRecipe {
  return { id, kind, roughness: [.35, .65], metalness: .45, microHeight: .000065,
    density: 3.2, variation: .12, scratches: .32, edgeWear: .28, polish: .04,
    wornRoughness: .34, substrate: [.58, .60, .62], preserveAtlas: false,
    normalStrength: .7, pattern: 0, ...values };
}
const polymer = { metalness: 0, roughness: [.46, .72] as [number, number], microHeight: .00010,
  edgeWear: .55, scratches: .25, polish: .13, wornRoughness: .43, color: '#303231' };
const rubber = { metalness: 0, roughness: [.72, .92] as [number, number], microHeight: .00015,
  density: 2.6, variation: .10, edgeWear: .24, scratches: .09, polish: .06, wornRoughness: .69, normalStrength: .4 };

/** Material families are sourced; numeric optical values and colors are artist-tuned. */
export const SURFACE_RECIPES = {
  'source-receiver': recipe('source-receiver', 'anodized', { preserveAtlas: true, roughness: [.32, .64], edgeWear: .20 }),
  'source-rail': recipe('source-rail', 'anodized', { preserveAtlas: true, roughness: [.38, .72], edgeWear: .18 }),
  'source-steel': recipe('source-steel', 'coated', { preserveAtlas: true, roughness: [.49, .80], microHeight: .00009, edgeWear: .18, wornRoughness: .43, substrate: [.48, .50, .52] }),
  'source-magazine': recipe('source-magazine', 'coated', { preserveAtlas: true, roughness: [.50, .81], edgeWear: .36, wornRoughness: .42 }),
  'source-polymer': recipe('source-polymer', 'polymer', { ...polymer, preserveAtlas: true, color: undefined }),
  'ris-anodized': recipe('ris-anodized', 'anodized', { color: '#796346', metalness: .48, roughness: [.34, .55], density: 4.1, edgeWear: .23, microHeight: .000045, substrate: [.66, .67, .68] }),
  'scout-anodized': recipe('scout-anodized', 'anodized', { color: '#292b2b', metalness: .50, roughness: [.30, .52], density: 4.8, edgeWear: .20, microHeight: .00004, substrate: [.66, .67, .68] }),
  'optic-housing': recipe('optic-housing', 'anodized', { color: '#827259', metalness: .35, roughness: [.37, .60], density: 4.0, edgeWear: .16, microHeight: .000045 }),
  'optic-mount': recipe('optic-mount', 'anodized', { color: '#27292a', metalness: .42, roughness: [.35, .59], density: 4.2, edgeWear: .22 }),
  'warden-cerakote': recipe('warden-cerakote', 'coated', { color: '#89724f', metalness: 0, roughness: [.52, .75], microHeight: .000085, density: 3.8, edgeWear: .30, scratches: .45, substrate: [.50, .52, .54] }),
  'warden-collar': recipe('warden-collar', 'coated', { color: '#282927', metalness: 0, roughness: [.44, .67], microHeight: .000055, edgeWear: .29, substrate: [.50, .52, .54] }),
  'ctr-molding': recipe('ctr-molding', 'polymer', { ...polymer, roughness: [.45, .64], microHeight: .000065, density: 4.0 }),
  'k2-molding': recipe('k2-molding', 'polymer', { ...polymer, roughness: [.48, .70], density: 3.8 }),
  'k2-tsp': recipe('k2-tsp', 'polymer', { ...polymer, color: '#2a2c2b', roughness: [.61, .82], microHeight: .00025, density: 5.6, pattern: 1, normalStrength: .18, polish: .19 }),
  'pmag-molding': recipe('pmag-molding', 'polymer', { ...polymer, roughness: [.43, .67], microHeight: .000075, density: 4.2 }),
  'pmag-grip': recipe('pmag-grip', 'polymer', { ...polymer, roughness: [.57, .79], microHeight: .00017, density: 3.4, polish: .17 }),
  'rvg-molding': recipe('rvg-molding', 'polymer', { ...polymer, roughness: [.47, .70], density: 3.8 }),
  'rvg-grip': recipe('rvg-grip', 'polymer', { ...polymer, roughness: [.60, .83], microHeight: .00018, density: 3.1, polish: .18 }),
  'rubber-pad': recipe('rubber-pad', 'rubber', { ...rubber, color: '#222322' }),
  'rubber-jacket': recipe('rubber-jacket', 'rubber', { ...rubber, color: '#73664e', roughness: [.64, .83], microHeight: .00011 }),
  'rubber-controls': recipe('rubber-controls', 'rubber', { ...rubber, color: '#202221', microHeight: .00008, roughness: [.61, .83] }),
  'dark-hardware': recipe('dark-hardware', 'metal', { color: '#373a3c', metalness: .68, roughness: [.30, .51], density: 5.0, microHeight: .000035, edgeWear: .32, scratches: .20 }),
  'glass-hws': recipe('glass-hws', 'glass', { metalness: 0, roughness: [.04, .04] }),
  'glass-magnifier': recipe('glass-magnifier', 'glass', { metalness: 0, roughness: [.035, .035] }),
  'glass-light': recipe('glass-light', 'glass', { metalness: 0, roughness: [.06, .06] }),
  marking: recipe('marking', 'marking'),
  recess: recipe('recess', 'recess', { color: '#111312', metalness: 0, roughness: [.86, .86] }),
  authored: recipe('authored', 'authored', { preserveAtlas: true }),
} as const;
export type SurfaceRecipeId = keyof typeof SURFACE_RECIPES;

const BASE_RECIPES: Record<string, SurfaceRecipeId> = {
  Base: 'source-receiver', Charging_Handle: 'source-receiver', Sight: 'source-receiver', Sight_2: 'source-receiver',
  Handguard: 'source-rail', Stock: 'source-polymer', Pistol_Grip: 'source-polymer', Magazine: 'source-magazine',
  Barrel: 'source-steel', Front_Sight: 'source-steel', Muzzle_Exterior: 'source-steel', Ejector_Lid: 'source-steel',
  Ejector_2: 'source-steel', Switch1: 'source-steel', Switch2: 'source-steel', Firemode_Selector: 'source-steel', Trigger: 'source-steel',
};

export function resolveSurfaceRecipe(object: Object3D, material: Material): SurfaceRecipe {
  const name = object.name, mat = material.name;
  const ancestry: string[] = [];
  for (let parent = object.parent; parent; parent = parent.parent) ancestry.push(parent.name);
  let id: SurfaceRecipeId = 'authored';
  if (mat === 'Smoky blue holographic window') id = 'glass-hws';
  else if (mat === 'Blue violet coated exterior lens') id = 'glass-magnifier';
  else if (mat === 'Original tinted light window') id = 'glass-light';
  else if (/Marking|Logo|Caution|Button_Icon/.test(name) || mat.startsWith('Observed ')) id = 'marking';
  else if (name === 'Warden_Opaque_front_surface' || name === 'Scout_Lens_inner_glint') id = 'recess';
  else if (name === 'Scout_Tail_surface') id = 'rubber-controls';
  else if (mat === 'Button and gasket rubber' && ancestry.some(n => ['EXPS3_Fasteners', 'EXPS3_Mount', 'G33_Adjustment_Caps'].includes(n))) id = 'recess';
  else if (mat.endsWith(' - source PBR')) id = BASE_RECIPES[name] ?? 'authored';
  else if (/^CTR_(Pad_rib|Shoulder_pad)/.test(name)) id = 'rubber-pad';
  else if (name === 'G33_Jacket_Seam' || mat === 'Tan rubber jacket') id = 'rubber-jacket';
  else if (mat === 'Button and gasket rubber' || mat === 'Original soft rubber details') id = 'rubber-controls';
  else if (name.startsWith('Scout_')) id = 'scout-anodized';
  else if (name.startsWith('Warden_')) id = /Main_shroud|Front_lip/.test(name) ? 'warden-cerakote' : 'warden-collar';
  else if (mat === 'Original decorative charcoal hardware' || mat === 'Recessed visible head finish') id = 'dark-hardware';
  else if (name.startsWith('RIS')) id = 'ris-anodized';
  else if (name.startsWith('K2_')) id = /Textured_panel/.test(name) ? 'k2-tsp' : 'k2-molding';
  else if (name.startsWith('PMAG_')) id = /Cross_rib|Long_rib|Flared_floorplate/.test(name) ? 'pmag-grip' : 'pmag-molding';
  else if (name.startsWith('RVG_')) id = /^RVG_(End_ridge|Textured_inset|Molded_grain)_/.test(name) ? 'rvg-grip' : 'rvg-molding';
  else if (name.startsWith('CTR_')) id = mat === 'Original dark anodized metal' ? 'dark-hardware' : 'ctr-molding';
  else if (mat === 'Mount charcoal anodized') id = 'optic-mount';
  else if (mat === 'Tan edge and cap metal' || mat === 'Tan anodized exterior - fine finish') id = 'optic-housing';
  return SURFACE_RECIPES[id];
}
