'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, Focus, Grid2X2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { ASSET_PARTS, M4_ASSET, WIKI_REFERENCES, WIKI_CHECK, type AssetStatus } from '@/lib/model-assets';
import { FINISHES, type FinishId, type AssetAppearance } from '@/lib/asset-appearance';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { VARIANTS, VARIANT_CATEGORIES, selectedVariant, type VariantCategory, type VariantId } from '@/lib/variant-catalogue';
import { PART_CHOICES, displayedChoice, type PartChoice } from '@/lib/part-library';
import { PartThumbnail } from '@/components/part-thumbnail';

export function AssetInspector({selected,hidden,finish,status,appearance,onVariant,onFlip,onFinish,onSelect,onToggle,onShowAll,onFocus,onClose}:{
  selected:string;hidden:string[];finish:FinishId;status:AssetStatus;appearance:AssetAppearance;onVariant:(category:VariantCategory,id:VariantId|'original')=>void;onFlip:()=>void;onFinish:(finish:FinishId)=>void;onSelect:(id:string)=>void;onToggle:(id:string)=>void;onShowAll:()=>void;onFocus:()=>void;onClose:()=>void;
}){
  const [query,setQuery]=useState('');
  const [allParts,setAllParts]=useState(false);
  const [hovered,setHovered]=useState<PartChoice|null>(null);
  const search=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    const previous=document.activeElement;
    search.current?.focus();
    return()=>{if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};
  },[]);
  useEffect(()=>{
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopPropagation();onClose();}};
    window.addEventListener('keydown',closeOnEscape);
    return()=>window.removeEventListener('keydown',closeOnEscape);
  },[onClose]);
  const part=ASSET_PARTS.find(p=>p.id===selected)??ASSET_PARTS[0];
  const nodes=status.report?.nodes??[];
  const available=status.report?.availableVariants??[];
  const category=VARIANT_CATEGORIES.find(c=>c.part===selected);
  const requested=category?selectedVariant(appearance.variants,category.id):undefined;
  const active=category?displayedChoice(appearance,category.id,available):undefined;
  const variant=VARIANTS.find(v=>v.id===active?.id);
  const replaced=VARIANTS.filter(v=>appearance.variants?.[v.category]===v.id&&available.includes(v.id)).some(v=>(v.replaces as readonly string[]).includes(selected));
  const absent=(['Optic','Foregrip','Light'].includes(selected)&&!variant)||(replaced&&!variant);
  const choices=PART_CHOICES.filter(c=>(allParts||!category||c.category===category.id)&&(!query||[c.name,c.maker,c.category,c.shortName].join(' ').toLowerCase().includes(query.toLowerCase())));
  const detail=hovered??active;
  const detailVariant=VARIANTS.find(v=>v.id===detail?.id);
  function choose(choice:PartChoice){onSelect(choice.part);onVariant(choice.category,choice.id);onClose();}
  return <aside id="attachment-library" className="asset-inspector attachment-picker" aria-label="Attachment library">
    <div className="panel-kicker">{allParts?'PART LIBRARY':part.name.toUpperCase()}<span>{choices.length.toString().padStart(2,'0')}</span><Button size="icon-xs" variant="ghost" aria-label="Close attachment library" onClick={onClose}><X/></Button></div>
    <div className="thumbnail-categories" aria-label="Filter attachment categories">
      <Button size="icon" variant="ghost" title="All parts" aria-label="All parts" aria-pressed={allParts} onClick={()=>{setAllParts(true);setQuery('');}}><Grid2X2/></Button>
      {VARIANT_CATEGORIES.map(c=>{const item=displayedChoice(appearance,c.id,available);return <button key={c.id} title={c.name} aria-label={c.name} aria-pressed={!allParts&&selected===c.part} onClick={()=>{setAllParts(false);setQuery('');setHovered(null);onSelect(c.part);}}><PartThumbnail id={item.thumbnail}/></button>;})}
    </div>
    <div className="library-search"><Search size={15}/><Input ref={search} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search parts" aria-label="Search attachment library"/>{query&&<Button size="icon-xs" variant="ghost" onClick={()=>setQuery('')} aria-label="Clear part search"><X/></Button>}</div>
    <div className="attachment-grid" aria-label={allParts?'All exterior choices':part.name+' choices'}>{choices.map(choice=>{
      const loaded=choice.id==='original'||available.includes(choice.id);
      const picked=displayedChoice(appearance,choice.category,available).id===choice.id;
      return <button key={choice.key} className={'attachment-tile '+(picked?'equipped-tile':'')} disabled={!loaded} aria-pressed={picked} aria-label={choice.maker+' '+choice.name+(picked?' — equipped':'')} title={choice.maker+' '+choice.name+(!loaded?' (artwork unavailable)':'')} onClick={()=>choose(choice)} onMouseEnter={()=>setHovered(choice)} onMouseLeave={()=>setHovered(null)} onFocus={()=>setHovered(choice)} onBlur={()=>setHovered(null)}>
        <span className="tile-code">{choice.shortName}</span><PartThumbnail id={choice.thumbnail}/><span className="tile-foot">{picked?<Check size={12}/>:<span/>}<span>{choice.id==='original'?'BASE':'MOD'}</span></span>
      </button>;
    })}{choices.length===0&&<div className="library-empty">No parts match this search.<Button size="sm" variant="ghost" onClick={()=>{setQuery('');setAllParts(true);}}>Show all parts</Button></div>}</div>
    <div className="library-detail"><PartThumbnail id={detail?.thumbnail??null}/><div><span>{detail?.maker??'Exterior artwork'}</span><strong>{detail?.name??part.name}</strong><small>{detail?VARIANT_CATEGORIES.find(c=>c.id===detail.category)?.name:part.note}</small></div>{detailVariant&&<a href={detailVariant.source} target="_blank" rel="noreferrer" title="Manufacturer reference" aria-label={'Manufacturer reference for '+detailVariant.name}><ExternalLink size={15}/></a>}</div>
    {requested&&!variant&&status.phase==='ready'&&<p className="library-warning">Selected artwork is unavailable. Showing the original appearance.</p>}
    <div className="library-tools"><Button variant="outline" size="sm" disabled={status.phase!=='ready'||hidden.includes(selected)||absent} onClick={onFocus}><Focus/>Inspect</Button><label htmlFor="selected-part-visible"><span>Visible</span><Switch id="selected-part-visible" size="sm" checked={!hidden.includes(selected)} onCheckedChange={()=>onToggle(selected)} aria-label={'Show '+part.name}/></label></div>
    {variant?.id==='hhs-viii'&&<div className="magnifier-setting"><div><strong>G33 position</strong><span>{appearance.magnifierFlipped?'Flipped aside':'In line with sight'}</span></div><Switch checked={appearance.magnifierFlipped??false} onCheckedChange={onFlip} aria-label="Flip magnifier aside"/></div>}
    <details className="finish-disclosure"><summary>Finish <span>{FINISHES.find(f=>f.id===finish)?.name}</span></summary><div className="asset-finishes compact-finishes"><RadioGroup value={finish} onValueChange={value=>onFinish(value as FinishId)} aria-label={part.name+' finish'}>{FINISHES.map(option=><label key={option.id} title={option.name}><span className="finish-chip" style={{backgroundColor:option.color}}/><span className="sr-only">{option.name}</span><RadioGroupItem value={option.id}/></label>)}</RadioGroup></div></details>
    <details className="geometry-disclosure"><summary>Exterior groups</summary><div className="asset-mesh-list">{ASSET_PARTS.filter(p=>nodes.includes(p.id)||['Optic','Foregrip','Light'].includes(p.id)).map(p=><div key={p.id} className={'asset-mesh-row '+(selected===p.id?'selected':'')}><button aria-pressed={selected===p.id} onClick={()=>onSelect(p.id)}>{p.name}</button><Switch size="sm" checked={!hidden.includes(p.id)} onCheckedChange={()=>onToggle(p.id)} aria-label={'Show '+p.name}/></div>)}</div></details>
    {hidden.length>0&&<div className="asset-inspector-bottom"><Button variant="ghost" size="sm" onClick={onShowAll}>Show hidden parts · {hidden.length}</Button></div>}
  </aside>;
}

export function ModelSources(){
  return <div className="model-sources">
    <div className="source-heading"><span>DISPLAYED ASSET</span><strong>{M4_ASSET.name}</strong><p>{M4_ASSET.creator} · {M4_ASSET.license}</p><a href={M4_ASSET.source} target="_blank" rel="noreferrer">Creator’s model page<ExternalLink size={13}/></a></div>
    <p>The Blender-refined base has 17 exterior mesh groups and 2K PBR textures. The handguard, pistol grip, front sight, and muzzle exterior are separate pieces. Most small fastener marks in the base remain texture detail.</p>
    <p>Eight new exterior accessory studies were modeled in Blender using product references, including the supplied EOTECH photographs. Names refer to the products being depicted. These are original approximate game-art recreations, not manufacturer CAD or verified 1:1 models. Display placement does not establish real-world fit.</p>
    <div className="source-heading"><span>MATERIALS &amp; FINISHES</span><p>Each modeled surface has its own material assignment, including rubber pads, textured polymer, anodized housings, ceramic coating, hardware and optical windows. Fresh, Used and Worn appearances change surface wear.</p></div>
    <p>Manufacturer descriptions guide material families. Colors, reflectivity and texture scale are artistic approximations. Mixed materials in the original model retain their texture maps; its exact product finishes remain unverified.</p>
    <a href="https://github.com/BooRussia/armory-m4a1/blob/main/docs/part-materials.md" target="_blank" rel="noreferrer">Part-by-part material references<ExternalLink size={13}/></a>
    <div className="source-heading"><span>ACCESSORY ART · MANUFACTURER REFERENCES</span><p>Product naming checked September 5, 2026. The G33 side flip is a visual animation; optical magnification is not simulated.</p></div>
    <div className="wiki-references">{VARIANTS.map(variant=><a href={variant.source} target="_blank" rel="noreferrer" key={variant.id}><span>{variant.maker}</span><strong>{variant.name}</strong><ExternalLink size={13}/></a>)}</div>
    <div className="source-heading"><span>TARKOV WIKI · GAME ITEM REFERENCES</span><p>These are documented game-item names for future art matching. They do not identify the meshes currently displayed.</p></div>
    <div className="wiki-references">{WIKI_REFERENCES.map(reference=><a href={reference.url} target="_blank" rel="noreferrer" key={reference.slug}><span>{reference.category}</span><strong>{reference.name}</strong><ExternalLink size={13}/></a>)}</div>
    <p className="source-access">Checked {WIKI_CHECK} through indexed wiki text. Direct page access was blocked; artwork and current game values remain unverified.</p>
    <p>Current behavior covers exterior variants, a magnifier flip, component visibility, cosmetic finishes, saved appearances, and animated inspection layouts. The separated view uses arbitrary spacing. Firing, recoil, ballistics, and internal mechanical operation are not simulated.</p>
  </div>;
}
