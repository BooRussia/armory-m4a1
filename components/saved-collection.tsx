'use client';
import { Bookmark, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SavedAppearance } from '@/lib/catalogue';
import type { SavedAssetAppearance } from '@/lib/asset-appearance';

export function SavedCollection({assets,concepts,onAsset,onConcept,onDeleteAsset,onDeleteConcept,onSave}:{
  assets:SavedAssetAppearance[];concepts:SavedAppearance[];onAsset:(item:SavedAssetAppearance)=>void;onConcept:(item:SavedAppearance)=>void;
  onDeleteAsset:(id:string)=>void;onDeleteConcept:(id:string)=>void;onSave:()=>void;
}){
  if(assets.length+concepts.length===0)return <div className="collection-empty"><Bookmark size={26}/><h2>Your collection starts here.</h2><p>Save an appearance to revisit it in this browser.</p><Button onClick={onSave}>Save current appearance</Button></div>;
  const entries=[...assets.map(item=>({item,kind:'asset' as const})),...concepts.map(item=>({item,kind:'concept' as const}))];
  return <div className="saved-list">{entries.map(entry=><div className="saved-row" key={entry.kind+entry.item.id}><button onClick={()=>{if(entry.kind==='asset')onAsset(entry.item);else onConcept(entry.item);}}><Bookmark size={17}/><span><strong>{entry.item.name}</strong><small>{entry.kind==='asset'?'M4A1 model':'Concept study'} · {new Date(entry.item.savedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</small></span></button><Button variant="ghost" size="icon-sm" aria-label={'Delete '+entry.item.name} onClick={()=>{if(entry.kind==='asset')onDeleteAsset(entry.item.id);else onDeleteConcept(entry.item.id);}}><Trash2 size={14}/></Button></div>)}</div>;
}
