'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { createM4Model, disposeM4Model } from '@/lib/m4-display-model';
import { CATALOGUE, label, type Config, type Slot } from '@/lib/catalogue';
import { loadDisplayAsset, disposeDisplayAsset } from '@/lib/gltf-model';
import { M4_ASSET, type ModelMode, type AssetStatus } from '@/lib/model-assets';
import { prepareAssetMaterials, isProtectedSurface } from '@/lib/asset-materials';
import type { AssetAppearance } from '@/lib/asset-appearance';
import { createDisplayLayout, visibleDisplayBounds, isDisplayVisible } from '@/lib/display-layout';
import { loadAccessoryLibrary } from '@/lib/asset-variants';
import { VARIANT_CATEGORIES } from '@/lib/variant-catalogue';
import { publicAsset } from '@/lib/public-asset';
import { displayedChoice } from '@/lib/part-library';
import { PartThumbnail } from '@/components/part-thumbnail';

export type ViewerHandle = { reloadAsset:()=>void; setView:(view:string)=>void; focusPart:(id:string)=>void; zoom:(factor:number)=>void; capture:()=>void; fullscreen:()=>void };
type Props = { pickerOpen?:boolean; mode:ModelMode; spread:boolean; reducedMotion:boolean; selectedAsset:string; appearance:AssetAppearance; onAssetPick:(id:string)=>void; onAssetStatus:(status:AssetStatus)=>void; config:Config; selectedSlot:Slot; light:'studio'|'soft'; exposure:number; rotate:boolean; quality:'high'|'balanced'; onPick:(slot:string)=>void; onReady:()=>void; onError:(message:string)=>void; onThumbnails:(images:Record<string,string>)=>void };
type Engine = { setMode:(mode:ModelMode)=>void; layout:()=>void; visibility:()=>void; focusPart:(id:string)=>void; setConfig:(config:Config)=>void; setView:(v:string)=>void; zoom:(factor:number)=>void; capture:()=>void; thumbnails:(config:Config,slot:Slot)=>void; settings:()=>void };
const CALLOUTS:{slot:Slot;name:string;x:number;y:number}[]=[
  {slot:'muzzle',name:'MUZZLE',x:.19,y:.31},
  {slot:'handguard',name:'HANDGUARD',x:.35,y:.16},
  {slot:'optic',name:'SIGHTS',x:.58,y:.12},
  {slot:'stock',name:'STOCK',x:.81,y:.30},
  {slot:'foregrip',name:'FOREGRIP',x:.30,y:.80},
  {slot:'magazine',name:'MAGAZINE',x:.53,y:.84},
  {slot:'finish',name:'FINISH',x:.75,y:.81},
];
const ASSET_CALLOUTS=[
  {slot:'Muzzle_Exterior',name:'Muzzle exterior',x:.17,y:.36},
  {slot:'Handguard',name:'Handguard',x:.34,y:.24},
  {slot:'Optic',name:'Optic',x:.56,y:.15},
  {slot:'Light',name:'Light',x:.22,y:.64},
  {slot:'Stock',name:'Stock',x:.81,y:.32},
  {slot:'Magazine',name:'Magazine',x:.49,y:.80},
  {slot:'Pistol_Grip',name:'Pistol grip',x:.70,y:.78},
  {slot:'Foregrip',name:'Foregrip',x:.34,y:.83},
];

const Viewer=forwardRef<ViewerHandle,Props>(function Viewer(props,ref){
  const mount=useRef<HTMLDivElement>(null);
  const engine=useRef<Engine|null>(null);
  const lines=useRef<Record<string,SVGLineElement|null>>({});
  const dots=useRef<Record<string,SVGCircleElement|null>>({});
  const latest=useRef(props);
  useEffect(()=>{latest.current=props;},[props]);
  const [error,setError]=useState('');
  const [availableVariantIds,setAvailableVariantIds]=useState<string[]>([]);
  const [retry,setRetry]=useState(0);
  const displayedCallouts=props.mode==='asset'?ASSET_CALLOUTS:CALLOUTS;
  const selectedCallout=props.mode==='asset'?props.selectedAsset:props.selectedSlot;
  useImperativeHandle(ref,()=>({
    reloadAsset:()=>setRetry(value=>value+1),
    setView:v=>engine.current?.setView(v),
    focusPart:id=>engine.current?.focusPart(id),
    zoom:f=>engine.current?.zoom(f),
    capture:()=>engine.current?.capture(),
    fullscreen:()=>{
      const viewport=mount.current?.parentElement;
      if(document.fullscreenElement){void document.exitFullscreen().catch(()=>latest.current.onError('Could not leave fullscreen.'));}
      else if(viewport?.requestFullscreen){void viewport.requestFullscreen().catch(()=>latest.current.onError('Fullscreen is unavailable in this browser.'));}
      else latest.current.onError('Fullscreen is unavailable in this browser.');
    }
  }),[]);

  useEffect(()=>{
    const host=mount.current;if(!host)return;
    let disposed=false;
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});}
    catch{queueMicrotask(()=>{if(!disposed){setError('3D rendering is unavailable. Enable hardware acceleration in your browser, then try again.');latest.current.onReady();}});return()=>{disposed=true;};}
    renderer.setClearColor(0x000000,0);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute('aria-label','Interactive M4A1 exterior model. Drag to rotate, scroll to zoom, and click an exterior component to select it.');
    renderer.domElement.setAttribute('role','img');
    host.appendChild(renderer.domElement);
    const scene=new THREE.Scene();
    RectAreaLightUniformsLib.init();
    const softbox=new THREE.RectAreaLight(0xfff7ec,5,5,2.2);
    softbox.position.set(-1,4,5);softbox.lookAt(0,0,0);scene.add(softbox);
    const stripbox=new THREE.RectAreaLight(0xe4edff,4,4,.65);
    stripbox.position.set(1,2,-4);stripbox.lookAt(0,0,0);scene.add(stripbox);
    let detailTexture:THREE.Texture|undefined;
    const detailReady=new THREE.TextureLoader().loadAsync(publicAsset('/assets/materials/surface-detail-v2.png')).then(texture=>{
      if(disposed){texture.dispose();return undefined;}
      texture.colorSpace=THREE.NoColorSpace;
      texture.premultiplyAlpha=false; // Alpha encodes grip height, not transparency.
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      texture.minFilter=THREE.LinearMipmapLinearFilter;
      texture.magFilter=THREE.LinearFilter;
      detailTexture=texture;return texture;
    }).catch(()=>undefined);
    const camera=new THREE.PerspectiveCamera(34,1,.02,120);
    const controls=new OrbitControls(camera,renderer.domElement);
    controls.enableDamping=true;controls.dampingFactor=.085;controls.enablePan=true;
    controls.minDistance=3;controls.maxDistance=35;controls.autoRotateSpeed=.6;
    const pmrem=new THREE.PMREMGenerator(renderer);
    const room=new RoomEnvironment();
    const env=pmrem.fromScene(room,.04);scene.environment=env.texture;
    room.dispose();pmrem.dispose();
    let photoEnvironment:THREE.DataTexture|null=null;
    new HDRLoader().load(publicAsset('/assets/studio.hdr'),texture=>{
      if(disposed){texture.dispose();return;}
      texture.mapping=THREE.EquirectangularReflectionMapping;
      photoEnvironment=texture;scene.environment=texture;scene.background=null;
      scene.backgroundBlurriness=.22;scene.backgroundIntensity=.12;
      scene.backgroundRotation.y=1.7;scene.environmentRotation.y=1.7;
    },undefined,()=>{ /* The self-contained studio remains available offline. */ });
    const hemi=new THREE.HemisphereLight(0xf1f3f7,0x1a1a20,2.1);scene.add(hemi);
    const key=new THREE.DirectionalLight(0xfff1d8,4.2);key.position.set(-2,7,5);scene.add(key);
    key.castShadow=true;key.shadow.mapSize.set(1024,1024);
    key.shadow.camera.left=-6;key.shadow.camera.right=6;key.shadow.camera.top=5;key.shadow.camera.bottom=-5;
    key.shadow.normalBias=.04;key.shadow.bias=-.0001;
    const rim=new THREE.DirectionalLight(0xd8e8ff,3.2);rim.position.set(2,4,-5);scene.add(rim);
    const fill=new THREE.DirectionalLight(0xe2e3ea,1.3);fill.position.set(-5,1,3);scene.add(fill);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(30,20),new THREE.ShadowMaterial({color:0x070709,opacity:.27}));
    ground.rotation.x=-Math.PI/2;ground.position.y=-1.92;ground.receiveShadow=true;scene.add(ground);
    let model:THREE.Group=new THREE.Group();scene.add(model);
    let activeMode:ModelMode|null=null;
    let assetMaterials:ReturnType<typeof prepareAssetMaterials>|null=null;
    let displayLayout:ReturnType<typeof createDisplayLayout>|null=null;
    let variants:Awaited<ReturnType<typeof loadAccessoryLibrary>>['controller']|null=null;
    let flipAmount=0;
    let layoutAmount=0;
    let assetGeneration=0;
    const center=new THREE.Vector3();
    let cameraView='perspective';
    let hovering='';
    const highlighted:{mesh:THREE.Mesh;original:THREE.Material|THREE.Material[];clones:THREE.Material[]}[]=[];
    function clearHighlight(){
      highlighted.forEach(h=>{h.mesh.material=h.original;h.clones.forEach(m=>m.dispose());});
      highlighted.length=0;hovering='';renderer.domElement.style.cursor='grab';
    }
    function highlight(slot:string){
      if(hovering===slot)return;clearHighlight();if(!slot)return;hovering=slot;
      model.traverse(obj=>{
        if(!(obj instanceof THREE.Mesh)||!isDisplayVisible(obj)||(activeMode==='asset'?obj.userData.assetPart:obj.userData.slot)!==slot)return;
        const original=obj.material;
        const clones=(Array.isArray(original)?original:[original]).map(m=>{
          const c=m.clone();c.onBeforeCompile=m.onBeforeCompile;c.customProgramCacheKey=m.customProgramCacheKey;if(c instanceof THREE.MeshStandardMaterial&&!isProtectedSurface(obj,m)){c.emissive.set(0x737786);c.emissiveIntensity=.08;}return c;
        });
        obj.material=Array.isArray(original)?clones:clones[0];highlighted.push({mesh:obj,original,clones});
      });
      renderer.domElement.style.cursor='pointer';
    }
    function frame(view:string){
      cameraView=view;const bounds=visibleDisplayBounds(model),size=bounds.getSize(new THREE.Vector3());
      if(!bounds.isEmpty())bounds.getCenter(center);
      if(size.lengthSq()===0)size.set(7.4,3,1);
      const distance=Math.max(size.y/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))),size.x/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect))*1.26;
      const side=activeMode==='asset'?-1:1;
      const direction=view==='left'?new THREE.Vector3(0,.02,-side):view==='top'?new THREE.Vector3(0,1,.001):view==='right'?new THREE.Vector3(0,.025,side):new THREE.Vector3(1.1,.62,12);
      camera.up.set(0,1,0);controls.target.copy(center);camera.position.copy(center).add(direction.normalize().multiplyScalar(distance));camera.lookAt(center);controls.update();
    }
    function resize(){
      const width=Math.max(host!.clientWidth,1),height=Math.max(host!.clientHeight,1);
      renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();frame(cameraView);
    }
    const observer=new ResizeObserver(resize);observer.observe(host);
    const pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster();
    const start={x:0,y:0};let dragging=false;
    function hit(event:PointerEvent){
      const rect=renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
      raycaster.setFromCamera(pointer,camera);
      const key=activeMode==='asset'?'assetPart':'slot';
      return String(raycaster.intersectObject(model,true).find(h=>isDisplayVisible(h.object)&&h.object.userData[key])?.object.userData[key]??'');
    }
    const down=(event:PointerEvent)=>{start.x=event.clientX;start.y=event.clientY;dragging=true;clearHighlight();};
    const up=(event:PointerEvent)=>{dragging=false;if(Math.hypot(event.clientX-start.x,event.clientY-start.y)<5){const slot=hit(event);if(slot){if(activeMode==='asset')latest.current.onAssetPick(slot);else latest.current.onPick(slot);}}};
    const move=(event:PointerEvent)=>{if(!dragging)highlight(hit(event));};
    const leave=()=>{dragging=false;clearHighlight();};
    const lost=(event:Event)=>{event.preventDefault();renderer.setAnimationLoop(null);setError('The graphics connection was interrupted. Restore the viewer to continue.');};
    renderer.domElement.addEventListener('pointerdown',down);
    renderer.domElement.addEventListener('pointerup',up);
    renderer.domElement.addEventListener('pointermove',move);
    renderer.domElement.addEventListener('pointerleave',leave);
    renderer.domElement.addEventListener('webglcontextlost',lost);
    let thumbRenderer:THREE.WebGLRenderer|null=null;
    const thumbScene=new THREE.Scene();thumbScene.environment=env.texture;
    thumbScene.add(new THREE.HemisphereLight(0xf4f6e9,0x4a513f,2.4));
    const thumbKey=new THREE.DirectionalLight(0xfff1dd,4);thumbKey.position.set(-1,4,6);thumbScene.add(thumbKey);
    const thumbRim=new THREE.DirectionalLight(0xe0eaff,2);thumbRim.position.set(2,3,-4);thumbScene.add(thumbRim);
    const thumbCamera=new THREE.PerspectiveCamera(30,420/164,.01,100);
    let thumbTimer:ReturnType<typeof setTimeout>|null=null;
    let generation=0;
    const cache=new Map<string,string>();
    function thumbnails(config:Config,slot:Slot){
      if(thumbTimer)clearTimeout(thumbTimer);const token=++generation;
      if(activeMode!=='concept')return;
      const options=CATALOGUE.find(c=>c.id===slot)!.options;
      const images:Record<string,string>={};let index=0;
      function next(){
        if(disposed||token!==generation)return;
        const option=options[index++];if(!option){latest.current.onThumbnails(images);return;}
        if(slot==='foregrip'&&option.id==='none'){thumbTimer=setTimeout(next,20);return;}
        const candidate={...config,[slot]:option.id};
        const key=slot+':'+JSON.stringify(candidate);
        const existing=cache.get(key);
        if(existing){images[slot+':'+option.id]=existing;thumbTimer=setTimeout(next,10);return;}
        let thumb:THREE.Group|null=null;
        try{
          if(!thumbRenderer){thumbRenderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'low-power'});thumbRenderer.setSize(420,164);thumbRenderer.setPixelRatio(1);thumbRenderer.setClearColor(0,0);thumbRenderer.outputColorSpace=THREE.SRGBColorSpace;thumbRenderer.toneMapping=THREE.ACESFilmicToneMapping;thumbRenderer.toneMappingExposure=1.15;}
          thumb=createM4Model(candidate);
          let focus:THREE.Object3D=thumb;
          if(slot!=='finish'&&slot!=='detail'){
            const target=thumb.children.find(child=>child.userData.slot===slot);
            if(target){focus=target;thumb.children.forEach(child=>{child.visible=child===target;});}
          }
          thumbScene.add(thumb);thumb.updateMatrixWorld(true);
          const box=new THREE.Box3().setFromObject(focus);const size=box.getSize(new THREE.Vector3()),mid=box.getCenter(new THREE.Vector3());
          const distance=Math.max(size.y,size.x/thumbCamera.aspect)/(2*Math.tan(THREE.MathUtils.degToRad(15)))*1.28;
          thumbCamera.position.copy(mid).add(new THREE.Vector3(.13,.14,1).normalize().multiplyScalar(distance));thumbCamera.lookAt(mid);
          thumbRenderer.render(thumbScene,thumbCamera);
          const image=thumbRenderer.domElement.toDataURL('image/png');cache.set(key,image);images[slot+':'+option.id]=image;
          if(cache.size>70)cache.delete(cache.keys().next().value!);
        }catch{ /* The main viewer remains usable if thumbnail rendering is unavailable. */ }
        finally{if(thumb)disposeM4Model(thumb);}
        latest.current.onThumbnails({...images});thumbTimer=setTimeout(next,30);
      }
      thumbTimer=setTimeout(next,120);
    }
    function settings(){
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,latest.current.quality==='high'?1.8:1));
      renderer.toneMappingExposure=latest.current.exposure;
      const asset=activeMode==='asset';
      controls.minDistance=asset ? .7 : 3;
      key.intensity=latest.current.light==='studio'?(asset?1.8:4.2):(asset ? .8 : 2.4);
      hemi.intensity=asset ? .25 : (latest.current.light==='studio'?2.1:3);
      rim.intensity=latest.current.light==='studio'?(asset?1.6:3.2):(asset ? .6 : 1.2);
      fill.intensity=asset ? .3 : 1.3;
      softbox.visible=stripbox.visible=asset;
      softbox.intensity=latest.current.light==='studio'?5:2.5;
      stripbox.intensity=latest.current.light==='studio'?4:1.4;
      if(asset){key.intensity*=.55;rim.intensity*=.55;}
      scene.environmentIntensity=latest.current.light==='studio' ? .85 : 1.15;
    }
    let currentConfig=JSON.stringify(latest.current.config);
    function visibility(){
      clearHighlight();if(activeMode!=='asset')return;
      variants?.apply(latest.current.appearance);
      assetMaterials?.apply(latest.current.appearance);
      updateAnchors();
    }
    function replaceModel(next:THREE.Group){
      clearHighlight();disposeDisplayAsset(model);model=next;scene.add(model);
      model.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(model);
      if(!bounds.isEmpty()){
        bounds.getCenter(center);ground.position.y=bounds.min.y-.05;
      }
      updateAnchors();
    }
    function setMode(mode:ModelMode){
      if(activeMode===mode)return;
      activeMode=mode;const token=++assetGeneration;
      assetMaterials=null;displayLayout=null;variants=null;layoutAmount=0;flipAmount=0;ground.visible=true;
      generation++;if(thumbTimer)clearTimeout(thumbTimer);
      replaceModel(new THREE.Group());settings();
      if(mode==='concept'){
        currentConfig=JSON.stringify(latest.current.config);
        replaceModel(createM4Model(latest.current.config));frame(cameraView);
        thumbnails(latest.current.config,latest.current.selectedSlot);
        latest.current.onReady();return;
      }
      latest.current.onAssetStatus({phase:'loading'});
      void Promise.all([loadDisplayAsset(M4_ASSET.url,renderer.capabilities.getMaxAnisotropy()),detailReady]).then(async ([result,detail])=>{
        if(disposed||token!==assetGeneration){disposeDisplayAsset(result.root);return;}
        let library:Awaited<ReturnType<typeof loadAccessoryLibrary>>;
        try{library=await loadAccessoryLibrary(result.root,renderer.capabilities.getMaxAnisotropy());}
        catch(error){disposeDisplayAsset(result.root);throw error;}
        if(disposed||token!==assetGeneration){disposeDisplayAsset(result.root);return;}
        variants=library.controller;
        setAvailableVariantIds(variants.available);
        result.report.availableVariants=variants.available;
        result.report.variantWarning=library.warning;
        assetMaterials=prepareAssetMaterials(result.root,detail);
        replaceModel(result.root);displayLayout=createDisplayLayout(model);
        layoutAmount=latest.current.spread?1:0;displayLayout.set(layoutAmount);ground.visible=layoutAmount===0;
        flipAmount=latest.current.appearance.magnifierFlipped?1:0;variants.flip(flipAmount);
        visibility();frame(cameraView);
        latest.current.onAssetStatus({phase:'ready',report:result.report});latest.current.onReady();
      }).catch(()=>{
        if(disposed||token!==assetGeneration)return;
        setAvailableVariantIds([]);
        latest.current.onAssetStatus({phase:'error',message:'The M4A1 asset could not load. Retry the model or open Concept studies.'});latest.current.onReady();
      });
    }
    engine.current={
      setMode,
      layout(){
        if(activeMode!=='asset'||!displayLayout)return;
        // Fit the separated layout before the visual transition so every piece stays in view.
        displayLayout.set(1);frame(cameraView);displayLayout.set(layoutAmount);updateAnchors();
      },
      visibility,
      focusPart(id){
        if(activeMode!=='asset')return;
        const box=visibleDisplayBounds(model,id);if(box.isEmpty())return;
        const size=box.getSize(new THREE.Vector3());
        const target=box.getCenter(new THREE.Vector3());
        const distance=Math.max(1,Math.max(size.y,size.x/camera.aspect)/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*1.35+size.z*.5);
        const direction=camera.position.clone().sub(controls.target).normalize();
        controls.target.copy(target);camera.position.copy(target).addScaledVector(direction,distance);controls.update();
      },
      setConfig(config){if(activeMode!=='concept')return;const next=JSON.stringify(config);if(next===currentConfig)return;currentConfig=next;replaceModel(createM4Model(config));},
      setView:frame,
      zoom(factor){const offset=camera.position.clone().sub(controls.target).multiplyScalar(factor);offset.setLength(THREE.MathUtils.clamp(offset.length(),controls.minDistance,controls.maxDistance));camera.position.copy(controls.target).add(offset);controls.update();},
      capture(){
        const background=scene.background;
        try{clearHighlight();scene.background=null;renderer.render(scene,camera);const a=document.createElement('a');a.download='armory-m4a1.png';a.href=renderer.domElement.toDataURL('image/png');a.click();latest.current.onError('Model image exported with a transparent background.');}
        catch{latest.current.onError('Image export is unavailable in this browser.');}
        finally{scene.background=background;}
      },
      thumbnails,settings,
    };
    const projected=new THREE.Vector3();
    const anchors=new Map<string,THREE.Vector3>();
    function updateAnchors(){
      anchors.clear();model.updateMatrixWorld(true);
      if(activeMode==='asset')ASSET_CALLOUTS.forEach(callout=>{
        const box=visibleDisplayBounds(model,callout.slot);
        if(!box.isEmpty())anchors.set(callout.slot,box.getCenter(new THREE.Vector3()));
      });
      else model.children.forEach(child=>anchors.set(String(child.userData.slot),new THREE.Box3().setFromObject(child).getCenter(new THREE.Vector3())));
    }
    setMode(latest.current.mode);settings();resize();
    let previousTime=0;
    renderer.setAnimationLoop(time=>{
      const delta=previousTime?Math.min((time-previousTime)/1000,.05):0;previousTime=time;
      if(disposed||document.hidden)return;
      if(activeMode==='asset'&&variants){
        const target=latest.current.appearance.magnifierFlipped?1:0;
        if(flipAmount!==target){
          flipAmount=latest.current.reducedMotion?target:THREE.MathUtils.damp(flipAmount,target,10,delta);
          if(Math.abs(flipAmount-target)<.001)flipAmount=target;
          variants.flip(flipAmount);updateAnchors();
        }
      }
      if(activeMode==='asset'&&displayLayout){
        const target=latest.current.spread?1:0;
        if(layoutAmount!==target){
          layoutAmount=latest.current.reducedMotion?target:THREE.MathUtils.damp(layoutAmount,target,9,delta);
          if(Math.abs(layoutAmount-target)<.001)layoutAmount=target;
          displayLayout.set(layoutAmount);ground.visible=layoutAmount===0;updateAnchors();
          if(layoutAmount===0)frame(cameraView);
        }
      }
      controls.autoRotate=latest.current.rotate;controls.update(delta);renderer.render(scene,camera);
      const width=host.clientWidth,height=host.clientHeight;
      (activeMode==='asset'?ASSET_CALLOUTS:CALLOUTS).forEach(callout=>{
        const anchor=anchors.get(callout.slot);
        const line=lines.current[callout.slot],dot=dots.current[callout.slot];
        const visible=!!anchor&&Number.isFinite(anchor.x);
        line?.setAttribute('visibility',visible?'visible':'hidden');dot?.setAttribute('visibility',visible?'visible':'hidden');
        if(!anchor||!visible)return;
        projected.copy(anchor).project(camera);
        const x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height;
        line?.setAttribute('x1',String(callout.x*width));line?.setAttribute('y1',String(callout.y*height));
        line?.setAttribute('x2',String(x));line?.setAttribute('y2',String(y));dot?.setAttribute('cx',String(x));dot?.setAttribute('cy',String(y));
      });
    });
    return()=>{
      disposed=true;assetGeneration++;generation++;if(thumbTimer)clearTimeout(thumbTimer);
      engine.current=null;renderer.setAnimationLoop(null);observer.disconnect();controls.dispose();clearHighlight();
      renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointerup',up);
      renderer.domElement.removeEventListener('pointermove',move);renderer.domElement.removeEventListener('pointerleave',leave);
      renderer.domElement.removeEventListener('webglcontextlost',lost);
      disposeDisplayAsset(model);ground.geometry.dispose();(ground.material as THREE.Material).dispose();key.shadow.dispose();
      env.dispose();photoEnvironment?.dispose();detailTexture?.dispose();thumbRenderer?.dispose();thumbRenderer?.forceContextLoss();cache.clear();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
    };
  },[retry]);
  useEffect(()=>{engine.current?.setMode(props.mode);},[props.mode]);
  useEffect(()=>{engine.current?.visibility();},[props.appearance]);
  useEffect(()=>{engine.current?.layout();},[props.spread]);
  useEffect(()=>{engine.current?.setConfig(props.config);engine.current?.thumbnails(props.config,props.selectedSlot);},[props.config,props.selectedSlot]);
  useEffect(()=>{engine.current?.settings();},[props.light,props.exposure,props.quality]);
  return <div className="three-mount" ref={mount}>
    <div className={'model-callouts '+(props.mode==='asset'?'thumbnail-callouts':'')}>
      <svg className="callout-lines" aria-hidden="true">{displayedCallouts.map(c=><g key={c.slot} className={selectedCallout===c.slot?'active':''}><line ref={node=>{lines.current[c.slot]=node;}}/><circle r={4} ref={node=>{dots.current[c.slot]=node;}}/></g>)}</svg>
      {displayedCallouts.map(c=>{
        const category=VARIANT_CATEGORIES.find(v=>v.part===c.slot);
        const item=category?displayedChoice(props.appearance,category.id,availableVariantIds):undefined;
        const hidden=props.appearance.hiddenParts.includes(c.slot);
        return <button key={c.slot} className={'model-callout '+(props.mode==='asset'?'slot-tile ':'')+(selectedCallout===c.slot?'active ':'')+(hidden?'hidden-slot':'')} data-part-slot={c.slot} style={{left:c.x*100+'%',top:c.y*100+'%'}} title={item?c.name+' · '+item.name:undefined} aria-label={item?c.name+': '+item.name+(hidden?' (hidden)':''):undefined} aria-expanded={props.mode==='asset'?props.pickerOpen&&selectedCallout===c.slot:undefined} aria-controls={props.mode==='asset'?'attachment-library':undefined} onClick={()=>{if(props.mode==='asset')props.onAssetPick(c.slot);else props.onPick(c.slot);}}>
          {props.mode==='asset'&&item?<><span className="slot-heading">{c.name.replace(' exterior','').toUpperCase()}</span><PartThumbnail id={item.thumbnail}/><span className="slot-item-name">{item.shortName}<span className={'slot-status '+(hidden?'is-hidden':'')}/></span></>:<><span>{c.name}</span><strong>{label(c.slot as Slot,props.config[c.slot as Slot])}</strong><span className="callout-action">INSPECT +</span></>}
        </button>;
      })}
    </div>
    {error&&<div className="viewer-error" role="alert"><h2>Viewer paused</h2><p>{error}</p><button onClick={()=>{setError('');setRetry(r=>r+1);}}>Restore viewer</button></div>}
  </div>;
});
export default Viewer;
