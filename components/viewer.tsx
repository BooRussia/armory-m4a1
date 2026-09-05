'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { createM4Model, disposeM4Model } from '@/lib/m4-display-model';
import { CATALOGUE, label, type Config, type Slot } from '@/lib/catalogue';

export type ViewerHandle = { setView:(view:string)=>void; zoom:(factor:number)=>void; capture:()=>void; fullscreen:()=>void };
type Props = { config:Config; selectedSlot:Slot; light:'studio'|'soft'; exposure:number; rotate:boolean; quality:'high'|'balanced'; onPick:(slot:string)=>void; onReady:()=>void; onError:(message:string)=>void; onThumbnails:(images:Record<string,string>)=>void };
type Engine = { setConfig:(config:Config)=>void; setView:(v:string)=>void; zoom:(factor:number)=>void; capture:()=>void; thumbnails:(config:Config,slot:Slot)=>void; settings:()=>void };
const CALLOUTS:{slot:Slot;name:string;x:number;y:number}[]=[
  {slot:'muzzle',name:'MUZZLE',x:.19,y:.31},
  {slot:'handguard',name:'HANDGUARD',x:.35,y:.16},
  {slot:'optic',name:'SIGHTS',x:.58,y:.12},
  {slot:'stock',name:'STOCK',x:.81,y:.30},
  {slot:'foregrip',name:'FOREGRIP',x:.30,y:.80},
  {slot:'magazine',name:'MAGAZINE',x:.53,y:.84},
  {slot:'finish',name:'FINISH',x:.75,y:.81},
];

const Viewer=forwardRef<ViewerHandle,Props>(function Viewer(props,ref){
  const mount=useRef<HTMLDivElement>(null);
  const engine=useRef<Engine|null>(null);
  const lines=useRef<Record<string,SVGLineElement|null>>({});
  const dots=useRef<Record<string,SVGCircleElement|null>>({});
  const latest=useRef(props);
  useEffect(()=>{latest.current=props;},[props]);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  useImperativeHandle(ref,()=>({
    setView:v=>engine.current?.setView(v),
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
    const camera=new THREE.PerspectiveCamera(34,1,.1,120);
    const controls=new OrbitControls(camera,renderer.domElement);
    controls.enableDamping=true;controls.dampingFactor=.085;controls.enablePan=true;
    controls.minDistance=3;controls.maxDistance=35;controls.autoRotateSpeed=.6;
    const pmrem=new THREE.PMREMGenerator(renderer);
    const room=new RoomEnvironment();
    const env=pmrem.fromScene(room,.04);scene.environment=env.texture;
    room.dispose();pmrem.dispose();
    let photoEnvironment:THREE.DataTexture|null=null;
    new HDRLoader().load('/assets/studio.hdr',texture=>{
      if(disposed){texture.dispose();return;}
      texture.mapping=THREE.EquirectangularReflectionMapping;
      photoEnvironment=texture;scene.environment=texture;scene.background=texture;
      scene.backgroundBlurriness=.22;scene.backgroundIntensity=.12;
      scene.backgroundRotation.y=1.7;scene.environmentRotation.y=1.7;
    },undefined,()=>{ /* The self-contained studio remains available offline. */ });
    const hemi=new THREE.HemisphereLight(0xe6efdb,0x323e28,2.1);scene.add(hemi);
    const key=new THREE.DirectionalLight(0xfff1d8,4.2);key.position.set(-2,7,5);scene.add(key);
    key.castShadow=true;key.shadow.mapSize.set(1024,1024);
    key.shadow.camera.left=-6;key.shadow.camera.right=6;key.shadow.camera.top=5;key.shadow.camera.bottom=-5;
    key.shadow.normalBias=.04;key.shadow.bias=-.0001;
    const rim=new THREE.DirectionalLight(0xd8e8ff,3.2);rim.position.set(2,4,-5);scene.add(rim);
    const fill=new THREE.DirectionalLight(0xd9e2bf,1.3);fill.position.set(-5,1,3);scene.add(fill);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(30,20),new THREE.ShadowMaterial({color:0x0b1007,opacity:.27}));
    ground.rotation.x=-Math.PI/2;ground.position.y=-1.92;ground.receiveShadow=true;scene.add(ground);
    let model=createM4Model(latest.current.config);scene.add(model);
    const center=new THREE.Vector3(0,.08,0);
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
        if(!(obj instanceof THREE.Mesh)||obj.userData.slot!==slot)return;
        const original=obj.material;
        const clones=(Array.isArray(original)?original:[original]).map(m=>{
          const c=m.clone();if(c instanceof THREE.MeshStandardMaterial){c.emissive.set(0x708839);c.emissiveIntensity=.13;}return c;
        });
        obj.material=Array.isArray(original)?clones:clones[0];highlighted.push({mesh:obj,original,clones});
      });
      renderer.domElement.style.cursor='pointer';
    }
    function frame(view:string){
      cameraView=view;const size=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
      const distance=Math.max(size.y/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))),size.x/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect))*1.26;
      const direction=view==='left'?new THREE.Vector3(0,.02,-1):view==='top'?new THREE.Vector3(0,1,.001):view==='right'?new THREE.Vector3(0,.025,1):new THREE.Vector3(1.1,.62,12);
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
      return String(raycaster.intersectObject(model,true).find(h=>h.object.userData.slot)?.object.userData.slot??'');
    }
    const down=(event:PointerEvent)=>{start.x=event.clientX;start.y=event.clientY;dragging=true;clearHighlight();};
    const up=(event:PointerEvent)=>{dragging=false;if(Math.hypot(event.clientX-start.x,event.clientY-start.y)<5){const slot=hit(event);if(slot)latest.current.onPick(slot);}};
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
      key.intensity=latest.current.light==='studio'?4.2:2.4;
      hemi.intensity=latest.current.light==='studio'?2.1:3;
      rim.intensity=latest.current.light==='studio'?3.2:1.2;
    }
    let currentConfig=JSON.stringify(latest.current.config);
    engine.current={
      setConfig(config){const next=JSON.stringify(config);if(next===currentConfig)return;clearHighlight();const old=model;model=createM4Model(config);currentConfig=next;scene.add(model);disposeM4Model(old);},
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
    settings();resize();thumbnails(latest.current.config,latest.current.selectedSlot);
    const projected=new THREE.Vector3();
    const anchors=new Map<string,THREE.Vector3>();
    function updateAnchors(){
      anchors.clear();model.updateMatrixWorld(true);
      model.children.forEach(child=>anchors.set(String(child.userData.slot),new THREE.Box3().setFromObject(child).getCenter(new THREE.Vector3())));
    }
    updateAnchors();
    const originalSetConfig=engine.current.setConfig;
    engine.current.setConfig=config=>{originalSetConfig(config);updateAnchors();};
    renderer.setAnimationLoop(()=>{
      if(disposed||document.hidden)return;controls.autoRotate=latest.current.rotate;controls.update();renderer.render(scene,camera);
      const width=host.clientWidth,height=host.clientHeight;
      CALLOUTS.forEach(callout=>{
        const anchor=anchors.get(callout.slot);if(!anchor||!Number.isFinite(anchor.x))return;
        projected.copy(anchor).project(camera);
        const x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height;
        const line=lines.current[callout.slot],dot=dots.current[callout.slot];
        line?.setAttribute('x1',String(callout.x*width));line?.setAttribute('y1',String(callout.y*height));
        line?.setAttribute('x2',String(x));line?.setAttribute('y2',String(y));dot?.setAttribute('cx',String(x));dot?.setAttribute('cy',String(y));
      });
    });
    latest.current.onReady();
    return()=>{
      disposed=true;generation++;if(thumbTimer)clearTimeout(thumbTimer);
      engine.current=null;renderer.setAnimationLoop(null);observer.disconnect();controls.dispose();clearHighlight();
      renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointerup',up);
      renderer.domElement.removeEventListener('pointermove',move);renderer.domElement.removeEventListener('pointerleave',leave);
      renderer.domElement.removeEventListener('webglcontextlost',lost);
      disposeM4Model(model);ground.geometry.dispose();(ground.material as THREE.Material).dispose();key.shadow.dispose();
      env.dispose();photoEnvironment?.dispose();thumbRenderer?.dispose();thumbRenderer?.forceContextLoss();cache.clear();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
    };
  },[retry]);
  useEffect(()=>{engine.current?.setConfig(props.config);engine.current?.thumbnails(props.config,props.selectedSlot);},[props.config,props.selectedSlot]);
  useEffect(()=>{engine.current?.settings();},[props.light,props.exposure,props.quality]);
  return <div className="three-mount" ref={mount}>
    <div className="model-callouts"><svg className="callout-lines" aria-hidden="true">{CALLOUTS.map(c=><g key={c.slot} className={props.selectedSlot===c.slot?'active':''}><line ref={node=>{lines.current[c.slot]=node;}}/><circle r={4} ref={node=>{dots.current[c.slot]=node;}}/></g>)}</svg>{CALLOUTS.map(c=><button key={c.slot} className={'model-callout '+(props.selectedSlot===c.slot?'active':'')} style={{left:c.x*100+'%',top:c.y*100+'%'}} onClick={()=>props.onPick(c.slot)}><span>{c.name}</span><strong>{label(c.slot,props.config[c.slot])}</strong><span className="callout-action">INSPECT +</span></button>)}</div>
    {error&&<div className="viewer-error" role="alert"><h2>Viewer paused</h2><p>{error}</p><button onClick={()=>{setError('');setRetry(r=>r+1);}}>Restore viewer</button></div>}
  </div>;
});
export default Viewer;
