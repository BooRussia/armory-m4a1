'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Aperture, ArrowDownToLine, ArrowRight, Bookmark, Box, Check, ChevronRight, CircleHelp, Crosshair, Download, Focus, Grip, Layers3, Maximize, Minus, MousePointer2, Palette, Plus, Redo2, RotateCcw, Save, Settings2, SlidersHorizontal, SquareStack, Sun, Trash2, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { CATALOGUE, DEFAULT, PRESETS, STORAGE_KEY, label, readAppearances, type Config, type Slot, type SavedAppearance } from '@/lib/catalogue';
import Viewer, { type ViewerHandle } from '@/components/viewer';

const ICONS = { handguard: Grip, stock: SquareStack, optic: Crosshair, magazine: Layers3, muzzle: Aperture, foregrip: MousePointer2, finish: Palette, detail: SlidersHorizontal };
export default function Workbench() {
  const [history,setHistory]=useState<Config[]>([{...DEFAULT}]);
  const [position,setPosition]=useState(0);
  const config=history[position];
  const [slot,setSlot]=useState<Slot>('handguard');
  const [inspecting,setInspecting]=useState(false);
  const [partsOpen,setPartsOpen]=useState(false);
  const [section,setSection]=useState('configure');
  const [saved,setSaved]=useState<SavedAppearance[]>([]);
  const [dialog,setDialog]=useState<'save'|'settings'|'about'|null>(null);
  const [name,setName]=useState('M4A1 — Custom study');
  const [notice,setNotice]=useState('');
  const [ready,setReady]=useState(false);
  const [view,setView]=useState('perspective');
  const [light,setLight]=useState<'studio'|'soft'>('studio');
  const [rotate,setRotate]=useState(false);
  const [reducedMotion,setReducedMotion]=useState(false);
  const [quality,setQuality]=useState<'high'|'balanced'>('high');
  const [exposure,setExposure]=useState(1.15);
  const [thumbs,setThumbs]=useState<Record<string,string>>({});
  const viewer=useRef<ViewerHandle>(null);
  const noticeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const selected=CATALOGUE.find(c=>c.id===slot)!;
  const activeOption=selected.options.find(o=>o.id===config[slot])!;
  const flash=useCallback((message:string)=>{setNotice(message);if(noticeTimer.current)clearTimeout(noticeTimer.current);noticeTimer.current=setTimeout(()=>setNotice(''),4500);},[]);
  const markReady=useCallback(()=>setReady(true),[]);
  useEffect(()=>{
    let cancelled=false;
    queueMicrotask(()=>{
      if(cancelled)return;
      try{setSaved(readAppearances(localStorage.getItem(STORAGE_KEY)));}catch{flash('Browser storage is unavailable. Export an appearance to keep a copy.');}
      setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    });
    return()=>{cancelled=true;if(noticeTimer.current)clearTimeout(noticeTimer.current);};
  },[flash]);
  const commit=useCallback((next:Config)=>{
    if(JSON.stringify(next)===JSON.stringify(config))return;
    const updated=[...history.slice(0,position+1),{...next}].slice(-80);setHistory(updated);setPosition(updated.length-1);
  },[config,history,position]);
  const undo=useCallback(()=>setPosition(p=>Math.max(0,p-1)),[]);
  const redo=useCallback(()=>setPosition(p=>Math.min(history.length-1,p+1)),[history.length]);
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      if((e.target as HTMLElement).closest('input,textarea,[contenteditable=true]')||dialog)return;
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();}
      if(e.key.toLowerCase()==='f'&&!e.ctrlKey&&!e.metaKey){viewer.current?.setView('perspective');setView('perspective');}
    };window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
  },[undo,redo,dialog]);
  const chooseView=(v:string)=>{setView(v);setRotate(false);viewer.current?.setView(v);};
  const persist=(next:SavedAppearance[])=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));setSaved(next);return true;}catch{flash('Could not save in this browser. Export the appearance to keep a copy.');return false;}};
  const save=()=>{
    if(!name.trim())return;
    if(persist([{id:crypto.randomUUID(),name:name.trim().slice(0,80),savedAt:new Date().toISOString(),config:{...config}},...saved].slice(0,100))){setDialog(null);flash('Appearance saved in this browser.');}
  };
  const exportAppearance=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify({format:'armory-appearance',version:1,platform:'m4a1-exterior-study',config},null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='armory-m4a1-appearance.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);flash('Appearance exported.');
  };
  const pick=useCallback((value:string)=>{if(CATALOGUE.some(c=>c.id===value)){setSlot(value as Slot);setSection('configure');setInspecting(true);setPartsOpen(false);}},[]);

  return <Tabs value={section} onValueChange={v=>setSection(String(v))} className="armory-app" render={<main/>}>
    <header className="topbar">
      <Link className="brand" href="/" aria-label="Armory home"><span className="brand-mark"><Box size={23} strokeWidth={1.5}/></span>ARMORY<span className="brand-edition">V.01</span></Link>
      <div className="main-tabs"><TabsList variant="line"><TabsTrigger value="configure">Workbench</TabsTrigger><TabsTrigger value="saved">My collection <span className="tab-count">{saved.length}</span></TabsTrigger></TabsList></div>
      <div className="header-actions"><span className="session-tag"><span/>LOCAL SESSION</span><Button variant="ghost" size="icon" aria-label="About this workbench" title="About this workbench" onClick={()=>setDialog('about')}><CircleHelp/></Button><Button variant="ghost" size="icon" aria-label="Viewer settings" title="Viewer settings" onClick={()=>setDialog('settings')}><Settings2/></Button></div>
    </header>
    <div className="workspace-heading"><div><div className="breadcrumb">WEAPON STUDIES <ChevronRight size={12}/> PLATFORM 01</div><div className="title-line"><h1>M4A1</h1><span className="study-tag">EXTERIOR STUDY</span></div></div><div className="heading-actions"><Button variant="outline" className="secondary-action" onClick={()=>setPartsOpen(v=>!v)} aria-pressed={partsOpen}><Layers3/><span>Components</span></Button><Button variant="outline" className="secondary-action" onClick={exportAppearance}><Download/><span>Export</span></Button><Button className="primary-action" onClick={()=>setDialog('save')}><Save/>Save appearance</Button></div></div>
    <TabsContent value={section} className="workbench-content"><div className={'workbench-grid immersive '+(section==='saved'?'collection-mode ':'')+(inspecting?'inspector-open ':'')+(partsOpen?'parts-open':'')}>
      <aside className="parts-panel" aria-label={section==='saved'?'Saved appearances':'Visual component categories'}>
        <div className="panel-kicker">{section==='saved'?'MY COLLECTION':'COMPONENTS'}<span>{section==='saved'?String(saved.length).padStart(2,'0'):'08'}</span></div>
        {section==='configure'?<div className="part-list">{CATALOGUE.map((part,i)=>{const Icon=ICONS[part.id];return <button key={part.id} className={'part-row '+(slot===part.id?'selected':'')} onClick={()=>pick(part.id)} aria-pressed={slot===part.id}><Icon size={19} strokeWidth={1.4}/><span><strong>{part.name}</strong><small>{label(part.id,config[part.id])}</small></span><span className="part-index">{String(i+1).padStart(2,'0')}</span></button>;})}</div>:<div className="saved-list">{saved.length===0?<div className="collection-empty"><Bookmark size={26}/><h2>Your collection starts here.</h2><p>Save an appearance to revisit it on this browser.</p><Button onClick={()=>setDialog('save')}>Save current appearance</Button></div>:saved.map(item=><div className="saved-row" key={item.id}><button onClick={()=>{commit(item.config);flash('Loaded '+item.name);}}><Bookmark size={17}/><span><strong>{item.name}</strong><small>{new Date(item.savedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</small></span></button><Button variant="ghost" size="icon-sm" aria-label={'Delete '+item.name} onClick={()=>{if(persist(saved.filter(s=>s.id!==item.id)))flash('Saved appearance removed.');}}><Trash2 size={14}/></Button></div>)}</div>}
        <div className="parts-bottom"><span className="live-dot"/>All changes are visual<div>Original concept components</div></div>
      </aside>
      <section className="viewport-column" aria-label="3D model workbench">
        <div className="viewport">
          <div className="viewport-label"><span className="live-dot"/>LIVE VIEW<span className="viewport-label-divider">/</span><span>{view==='perspective'?'PERSPECTIVE':view==='left'?'LEFT PROFILE':view==='right'?'RIGHT PROFILE':'TOP VIEW'}</span></div>
          <div className="viewport-history"><Button variant="ghost" size="icon" aria-label="Undo change" title="Undo (Ctrl+Z)" disabled={position===0} onClick={undo}><Undo2/></Button><Button variant="ghost" size="icon" aria-label="Redo change" title="Redo (Ctrl+Shift+Z)" disabled={position===history.length-1} onClick={redo}><Redo2/></Button><span/><Button variant="ghost" size="icon" aria-label="Reset appearance" title="Reset appearance" onClick={()=>{commit(DEFAULT);flash('Default appearance restored.');}}><RotateCcw/></Button></div>
          <Viewer ref={viewer} config={config} selectedSlot={slot} light={light} exposure={exposure} rotate={rotate&&!reducedMotion} quality={quality} onPick={pick} onReady={markReady} onError={flash} onThumbnails={setThumbs}/>
          {!ready&&<div className="model-loading"><span/>Preparing the workbench</div>}
          <div className="viewport-side-tools"><Button variant="ghost" size="icon" aria-label="Zoom in" title="Zoom in" onClick={()=>viewer.current?.zoom(.85)}><Plus/></Button><Button variant="ghost" size="icon" aria-label="Zoom out" title="Zoom out" onClick={()=>viewer.current?.zoom(1.15)}><Minus/></Button><span/><Button variant="ghost" size="icon" aria-label="Fit model" title="Fit model (F)" onClick={()=>chooseView('perspective')}><Focus/></Button></div>
          <div className="model-caption"><span>COLT M4A1</span><div>{label('finish',config.finish)}<span> / </span>{label('handguard',config.handguard)}</div></div>
          <div className="view-strip"><div className="camera-views" aria-label="Camera views">{[['perspective','3D'],['right','Right'],['left','Left'],['top','Top']].map(([value,text])=><button key={value} onClick={()=>chooseView(value)} className={view===value?'active':''} aria-pressed={view===value}>{text}</button>)}</div><div className="view-strip-actions"><button className={light==='soft'?'active':''} aria-label="Toggle studio lighting" title="Toggle lighting" onClick={()=>setLight(l=>l==='studio'?'soft':'studio')}><Sun size={17}/><span>{light==='studio'?'Studio':'Soft'}</span></button><button aria-label="Export model image" title="Export image" onClick={()=>viewer.current?.capture()}><ArrowDownToLine size={17}/></button><button aria-label="Toggle fullscreen viewer" title="Fullscreen" onClick={()=>viewer.current?.fullscreen()}><Maximize size={16}/></button></div></div>
        </div>
        <div className="interaction-hint"><span><MousePointer2 size={13}/>Drag to orbit</span><span>Scroll to zoom</span><span>Click a part to inspect</span><span className="hint-key">F <span>Fit view</span></span></div>
        <div className="study-presets"><div className="preset-heading"><span>QUICK STUDIES</span><span>03</span></div><div className="preset-list">{PRESETS.map((preset,i)=><button key={preset.id} className={'preset-card '+(JSON.stringify(config)===JSON.stringify(preset.config)?'active':'')} onClick={()=>{commit(preset.config);flash(preset.name+' applied');}}><span className={'preset-swatch preset-'+preset.config.finish}/><div><span className="preset-number">0{i+1}</span><strong>{preset.name}</strong><small>{preset.note}</small></div><ArrowRight size={15}/></button>)}</div></div>
      </section>
      <aside className="options-panel" aria-label={selected.name+' appearance options'}>
        <div className="panel-kicker">{selected.short.toUpperCase()}<span>{String(selected.options.length).padStart(2,'0')}</span></div><div className="options-title"><button className="close-inspector" aria-label="Close component inspector" onClick={()=>setInspecting(false)}><X size={16}/></button><h2>{selected.name}</h2><p>Choose an exterior style.</p></div>
        <RadioGroup value={config[slot]} onValueChange={value=>commit({...config,[slot]:value} as Config)} aria-label={selected.name} className="option-list">{selected.options.map((option,i)=><label key={slot+'-'+option.id} className={'option-card '+(config[slot]===option.id?'active':'')} htmlFor={'option-'+slot+'-'+option.id}>
          <div className={'option-preview '+(option.swatch?'finish-preview':'')}>{thumbs[slot+':'+option.id]?<Image src={thumbs[slot+':'+option.id]} alt={option.name+' exterior preview'} width={420} height={164} unoptimized/>:option.swatch?<span className="large-swatch" style={{backgroundColor:option.swatch}}/>:<span className="preview-index">{option.id==='none'?'—':'0'+(i+1)}</span>}<span className="option-code">A / {String(i+1).padStart(2,'0')}</span>{config[slot]===option.id&&<span className="equipped"><Check size={11}/>SELECTED</span>}</div>
          <div className="option-info"><div><span>{option.subtitle}</span><strong>{option.name}</strong></div><RadioGroupItem value={option.id} id={'option-'+slot+'-'+option.id}/></div>
        </label>)}</RadioGroup>
        <div className="option-description"><span>IN FOCUS</span><p>{activeOption.description}</p></div><div className="concept-note"><Box size={13}/><span>Studio concept · visual model</span></div>
      </aside>
    </div></TabsContent>
    <footer className="statusbar"><span><span className="live-dot"/>{ready?'WORKBENCH READY':'INITIALIZING'}</span><span>01 PLATFORM<span className="status-divider">/</span>08 VISUAL CATEGORIES</span><button onClick={()=>setDialog('about')}>MODEL NOTES<ChevronRight size={12}/></button></footer>
    {notice&&<output className="notice"><Check size={16}/>{notice}<button aria-label="Dismiss notification" onClick={()=>setNotice('')}><X size={14}/></button></output>}
    <Dialog open={dialog!==null} onOpenChange={open=>{if(!open)setDialog(null);}}><DialogContent className="armory-dialog"><DialogHeader><DialogTitle>{dialog==='save'?'Save appearance':dialog==='settings'?'Viewer settings':'About this study'}</DialogTitle><DialogDescription>{dialog==='save'?'Keep this look in your local collection.':dialog==='settings'?'Adjust the workbench to your display.':'An original interactive exterior study of the M4A1.'}</DialogDescription></DialogHeader>
      {dialog==='save'&&<form onSubmit={e=>{e.preventDefault();save();}}><label className="field-label" htmlFor="appearance-name">Appearance name</label><Input id="appearance-name" value={name} onChange={e=>setName(e.target.value)} maxLength={80}/><p className="dialog-note">Saved on this browser. Export a copy to keep it outside your browser.</p><div className="dialog-actions"><Button variant="outline" onClick={()=>setDialog(null)}>Cancel</Button><Button type="submit" disabled={!name.trim()}><Save/>Save appearance</Button></div></form>}
      {dialog==='settings'&&<div className="settings-fields"><div className="setting-row"><label htmlFor="auto-rotate">Turntable rotation</label><Switch id="auto-rotate" checked={rotate} disabled={reducedMotion} onCheckedChange={setRotate}/></div><div className="setting-row"><label htmlFor="reduced-motion">Reduced motion</label><Switch id="reduced-motion" checked={reducedMotion} onCheckedChange={setReducedMotion}/></div><div><div className="field-label" id="exposure-label">Light intensity<span>{exposure.toFixed(2)}</span></div><Slider aria-labelledby="exposure-label" value={[exposure]} min={.6} max={1.8} step={.05} onValueChange={v=>setExposure(Array.isArray(v)?v[0]:v)}/></div><div><div className="field-label" id="quality-label">Render quality</div><RadioGroup value={quality} aria-labelledby="quality-label" onValueChange={v=>setQuality(v as 'high'|'balanced')} className="quality-options">{['high','balanced'].map(v=><label key={v}><RadioGroupItem value={v}/>{v==='high'?'High detail':'Balanced'}</label>)}</RadioGroup></div></div>}
      {dialog==='about'&&<div className="about-copy"><p>This first workbench uses an original artist-authored exterior model and concept variants. It is a visual approximation, not a licensed Colt model or a replica of Tarkov’s assets.</p><p>Selections change appearance only. Names such as “Slimline” and “Precision” describe these concepts; they do not identify commercial components or establish real-world compatibility.</p><p>Model scope: exterior geometry, material finishes, and display details. Functional internals and firing simulation are not included.</p><p className="dialog-note">Independent project. Not affiliated with Colt or Battlestate Games.</p></div>}
    </DialogContent></Dialog>
  </Tabs>;
}
