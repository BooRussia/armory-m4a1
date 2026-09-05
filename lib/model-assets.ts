import { publicAsset } from './public-asset';

export type ModelMode = 'asset' | 'concept';
export type AssetReport = { meshes: number; triangles: number; materials: number; textures: number; textureSize: number; nodes: string[]; availableVariants?: string[]; variantWarning?: string };
export type AssetStatus = { phase: 'loading' | 'ready' | 'error'; report?: AssetReport; message?: string };

export const M4_ASSET = {
  url: publicAsset('/assets/m4a1/m4a1-blender-v2.glb'),
  name: 'M4A1 Assault Rifle',
  creator: 'nisu / 3DModelsCC0',
  license: 'CC0',
  source: 'https://opengameart.org/content/m4a1-assault-rifle',
  creatorSource: 'https://opengameart.org/users/nisu',
};

// Stable artist mesh IDs; four exterior groups were separated in Blender.
export const BASE_MODEL_PARTS = [
  { id: 'Base', name: 'Receiver exterior', note: 'Original body artwork' },
  { id: 'Barrel', name: 'Barrel exterior', note: 'Individual exterior shell' },
  { id: 'Handguard', name: 'Handguard', note: 'Separated in Blender' },
  { id: 'Pistol_Grip', name: 'Pistol grip', note: 'Separated with refined edge highlights' },
  { id: 'Front_Sight', name: 'Front sight', note: 'Separated in Blender' },
  { id: 'Muzzle_Exterior', name: 'Muzzle exterior', note: 'Separated with refined edge highlights' },
  { id: 'Stock', name: 'Stock', note: 'Refined edge highlights' },
  { id: 'Magazine', name: 'Magazine', note: 'Cleaned topology and refined edges' },
  { id: 'Sight', name: 'Sight 01', note: 'Original mesh group' },
  { id: 'Sight_2', name: 'Sight 02', note: 'Original mesh group' },
  { id: 'Charging_Handle', name: 'Charging handle', note: 'Exterior mesh' },
  { id: 'Ejector_Lid', name: 'Side cover', note: 'Original mesh group' },
  { id: 'Ejector_2', name: 'Side detail', note: 'Original mesh group' },
  { id: 'Switch1', name: 'Control 01', note: 'Original mesh group' },
  { id: 'Switch2', name: 'Control 02', note: 'Original mesh group' },
  { id: 'Firemode_Selector', name: 'Selector exterior', note: 'Static exterior mesh' },
  { id: 'Trigger', name: 'Trigger exterior', note: 'Static exterior mesh' },
];

export const ASSET_PARTS = [...BASE_MODEL_PARTS,
  { id: 'Optic', name: 'Optic', note: 'Reference-based sight and magnifier artwork' },
  { id: 'Foregrip', name: 'Foregrip', note: 'Optional exterior grip artwork' },
  { id: 'Light', name: 'Light', note: 'Optional light exterior artwork' },
];

// These records identify wiki game items. They are not identities assigned to the
// bundled artist mesh, compatibility rules, or a source of reusable artwork.
export const WIKI_REFERENCES = [
  { name: 'M4A1 5.56x45 upper receiver', slug: 'M4A1_5.56x45_upper_receiver', category: 'Upper receiver' },
  { name: 'AR-15 KAC RIS handguard', slug: 'AR-15_KAC_RIS_handguard', category: 'Handguard' },
  { name: 'AR-15 Colt A2 pistol grip', slug: 'AR-15_Colt_A2_pistol_grip', category: 'Pistol grip' },
  { name: 'AR-15 Colt charging handle', slug: 'AR-15_Colt_charging_handle', category: 'Charging handle' },
  { name: 'AR-15 5.56x45 Colt STANAG 30-round magazine', slug: 'AR-15_5.56x45_Colt_STANAG_30-round_magazine', category: 'Magazine' },
  { name: 'AR-15 rear sight carry handle', slug: 'AR-15_rear_sight_carry_handle', category: 'Carry handle' },
].map(record => ({ ...record, url: 'https://escapefromtarkov.fandom.com/wiki/' + record.slug }));

export const WIKI_CHECK = 'September 4, 2026';
