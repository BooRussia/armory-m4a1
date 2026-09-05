import { publicAsset } from './public-asset';

export const VARIANT_CATEGORIES = [
  { id: 'optic', part: 'Optic', name: 'Optic', original: 'Original sights' },
  { id: 'handguard', part: 'Handguard', name: 'Handguard', original: 'Original handguard' },
  { id: 'stock', part: 'Stock', name: 'Stock', original: 'Original stock' },
  { id: 'grip', part: 'Pistol_Grip', name: 'Pistol grip', original: 'Original grip' },
  { id: 'magazine', part: 'Magazine', name: 'Magazine', original: 'Original magazine' },
  { id: 'foregrip', part: 'Foregrip', name: 'Foregrip', original: 'No foregrip' },
  { id: 'muzzle', part: 'Muzzle_Exterior', name: 'Muzzle exterior', original: 'Original muzzle' },
  { id: 'light', part: 'Light', name: 'Light', original: 'No light' },
] as const;
export type VariantCategory = typeof VARIANT_CATEGORIES[number]['id'];
export const VARIANT_BUNDLES = [
  publicAsset('/assets/m4a1/hhs-viii.glb'),
  publicAsset('/assets/m4a1/exterior-variants.glb'),
] as const;
export const VARIANTS = [
  { id: 'hhs-viii', category: 'optic', root: 'HHS_VIII_Visual', bundle: 0, name: 'HHS VIII TAN', maker: 'EOTECH', description: 'EXPS3-0 holographic sight + G33 magnifier. Animated side flip.', replaces: ['Sight','Sight_2','Switch1','Switch2'], source: 'https://www.eotechinc.com/products/eotech-hhs-viii-tan', preview: 'hhs-viii.png' },
  { id: 'ris-ii', category: 'handguard', root: 'RISII_Handguard', bundle: 1, name: 'M4A1 RIS II · FDE', maker: 'Daniel Defense', description: 'Long quad-rail exterior with vented sides and separate detail meshes.', replaces: ['Handguard','Front_Sight'], source: 'https://danieldefense.com/m4a1-risii-fde.html', preview: 'ris-ii.png' },
  { id: 'ctr', category: 'stock', root: 'CTR_Stock', bundle: 1, name: 'CTR Carbine Stock – Mil-Spec', maker: 'Magpul', description: 'Angular A-frame profile with a contrasting rubber buttpad.', replaces: ['Stock'], source: 'https://magpul.com/ctr-carbine-stock-mil-spec.html', preview: 'ctr.png' },
  { id: 'moe-k2', category: 'grip', root: 'K2_Grip', bundle: 1, name: 'MOE-K2 Grip – AR15/M4', maker: 'Magpul', description: 'Upright grip silhouette, raised beavertail and molded surface details.', replaces: ['Pistol_Grip'], source: 'https://magpul.com/moe-k2-grip-ar15-m4.html', preview: 'moe-k2.png' },
  { id: 'pmag-m3', category: 'magazine', root: 'PMAG_Magazine', bundle: 1, name: 'PMAG 30 AR/M4 GEN M3', maker: 'Magpul', description: 'Non-window polymer exterior with raised panels and a flared floorplate.', replaces: ['Magazine'], source: 'https://magpul.com/pmag-30-ar-m4-gen-m3.html', preview: 'pmag-m3.png' },
  { id: 'rvg', category: 'foregrip', root: 'RVG_Foregrip', bundle: 1, name: 'RVG – Rail Vertical Grip', maker: 'Magpul', description: 'Compact vertical grip with contrasting molded ridges.', replaces: [], source: 'https://magpul.com/rvg-rail-vertical-grip.html', preview: 'rvg.png' },
  { id: 'warden', category: 'muzzle', root: 'Warden_Muzzle', bundle: 1, name: 'Warden · Fast-Attach', maker: 'SureFire', description: 'Cylindrical blast-regulator exterior with a distinct rear collar.', replaces: ['Muzzle_Exterior'], source: 'https://www.surefire.com/warden/', preview: 'warden.png' },
  { id: 'm600u', category: 'light', root: 'Scout_Light', bundle: 1, name: 'M600U Scout Light', maker: 'SureFire', description: 'Compact light body, stepped bezel, front glass and tailcap details.', replaces: [], source: 'https://www.surefire.com/m600u-scout-light-weaponlight/', preview: 'm600u.png' },
] as const;
export type VariantId = typeof VARIANTS[number]['id'];
export type VariantSelection = Partial<Record<VariantCategory, VariantId>>;
export const SHOWCASE_VARIANTS: VariantSelection = Object.fromEntries(VARIANTS.map(v => [v.category, v.id]));
export function selectedVariant(selection: VariantSelection | undefined, category: VariantCategory) {
  return VARIANTS.find(v => v.id === selection?.[category] && v.category === category);
}
export function validVariants(value: unknown): value is VariantSelection {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.entries(value).every(([category,id]) => VARIANTS.some(v => v.id === id && v.category === category));
}
