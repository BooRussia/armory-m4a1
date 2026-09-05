import type { AssetAppearance } from './asset-appearance';
import { VARIANTS, VARIANT_CATEGORIES, type VariantCategory, type VariantId } from './variant-catalogue';

const SHORT_NAMES: Record<VariantId,string> = {
  'hhs-viii':'HHS VIII', 'ris-ii':'RIS II', ctr:'CTR', 'moe-k2':'MOE-K2',
  'pmag-m3':'GEN M3', rvg:'RVG', warden:'Warden', m600u:'M600U',
};
export type PartChoice = {
  key:string; category:VariantCategory; part:string; id:VariantId|'original';
  name:string; shortName:string; maker:string; thumbnail:string|null;
};
export const PART_CHOICES: PartChoice[] = VARIANT_CATEGORIES.flatMap(category => [
  { key:category.id+':original', category:category.id, part:category.part, id:'original' as const,
    name:category.original, shortName:['foregrip','light'].includes(category.id)?'None':'Original', maker:'Base artwork',
    thumbnail:['foregrip','light'].includes(category.id)?null:'original-'+category.id },
  ...VARIANTS.filter(v=>v.category===category.id).map(v=>({ key:v.id, category:category.id, part:category.part,
    id:v.id, name:v.name, shortName:SHORT_NAMES[v.id], maker:v.maker, thumbnail:v.id })),
]);
export function displayedChoice(appearance:AssetAppearance, category:VariantCategory, available:readonly string[]) {
  const requested=appearance.variants?.[category];
  return PART_CHOICES.find(c=>c.category===category&&c.id===(requested&&available.includes(requested)?requested:'original'))!;
}
