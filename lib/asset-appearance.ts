import { ASSET_PARTS } from './model-assets';
import { SHOWCASE_VARIANTS, validVariants, type VariantSelection } from './variant-catalogue';

export const FINISHES = [
  { id: 'original', name: 'Artist original', color: '#777b70' },
  { id: 'graphite', name: 'Graphite', color: '#414643' },
  { id: 'sand', name: 'Sand', color: '#a8926e' },
  { id: 'olive', name: 'Olive', color: '#65704f' },
] as const;
export type FinishId = typeof FINISHES[number]['id'];
export type AssetAppearance = { hiddenParts: string[]; finishes: Record<string, FinishId>; variants?: VariantSelection; magnifierFlipped?: boolean };
export const DEFAULT_ASSET: AssetAppearance = { hiddenParts: [], finishes: {} };
export const SHOWCASE_ASSET: AssetAppearance = { hiddenParts: [], finishes: {}, variants: SHOWCASE_VARIANTS, magnifierFlipped: false };
export const ASSET_STORAGE_KEY = 'armory:asset-appearances:v1';
export type SavedAssetAppearance = { id: string; name: string; savedAt: string; appearance: AssetAppearance };
const ids = new Set<string>(ASSET_PARTS.map(part => part.id));
const finishIds = new Set<string>(FINISHES.map(finish => finish.id));

export function validAssetAppearance(value: unknown): value is AssetAppearance {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Array.isArray(item.hiddenParts) && item.hiddenParts.length <= ids.size
    && item.hiddenParts.every(id => typeof id === 'string' && ids.has(id))
    && new Set(item.hiddenParts).size === item.hiddenParts.length
    && !!item.finishes && typeof item.finishes === 'object' && !Array.isArray(item.finishes)
    && Object.entries(item.finishes).every(([id, finish]) => ids.has(id) && typeof finish === 'string' && finishIds.has(finish))
    && (item.variants === undefined || validVariants(item.variants))
    && (item.magnifierFlipped === undefined || typeof item.magnifierFlipped === 'boolean');
}

export function readAssetAppearances(raw: string | null): SavedAssetAppearance[] {
  try {
    const value: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is SavedAssetAppearance => !!item && typeof item === 'object'
      && typeof item.id === 'string' && item.id.length <= 80
      && typeof item.name === 'string' && item.name.trim().length > 0 && item.name.length <= 80
      && typeof item.savedAt === 'string' && Number.isFinite(Date.parse(item.savedAt))
      && validAssetAppearance(item.appearance)).slice(0, 100);
  } catch { return []; }
}

export function assetExport(appearance: AssetAppearance) {
  return { format: 'armory-visual-assembly', version: 2, asset: 'm4a1-exterior', appearance };
}

export function readAssetExport(raw: string): AssetAppearance | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const item = value as Record<string, unknown>;
    return item.format === 'armory-visual-assembly' && (item.version === 1 || item.version === 2) && item.asset === 'm4a1-exterior'
      && validAssetAppearance(item.appearance) ? item.appearance : null;
  } catch { return null; }
}
