import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import ts from 'typescript';
import * as THREE from 'three';

const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cache=path.join(app,'node_modules','.cache','armory-asset-test');
fs.mkdirSync(cache,{recursive:true});
const modules=['model-assets','gltf-model','asset-appearance','asset-materials','surface-geometry','display-layout','catalogue','variant-catalogue','asset-variants','public-asset','part-library'];
for(const name of modules){
  const source=fs.readFileSync(path.join(app,'lib',name+'.ts'),'utf8');
  let output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  for(const dependency of modules)output=output.replaceAll("'./"+dependency+"'","'./"+dependency+".mjs'");
  fs.writeFileSync(path.join(cache,name+'.mjs'),output);
}
const moduleFor=name=>import(pathToFileURL(path.join(cache,name+'.mjs')));
const {loadDisplayAsset,disposeDisplayAsset}=await moduleFor('gltf-model');
const {BASE_MODEL_PARTS,M4_ASSET}=await moduleFor('model-assets');
const {prepareAssetMaterials,surfaceKind}=await moduleFor('asset-materials');
const {prepareSurfaceGeometry}=await moduleFor('surface-geometry');
const {createDisplayLayout,visibleDisplayBounds,isDisplayVisible}=await moduleFor('display-layout');
const {DEFAULT,readConceptExport}=await moduleFor('catalogue');
const {DEFAULT_ASSET,SHOWCASE_ASSET,validAssetAppearance,readAssetAppearances,assetExport,readAssetExport}=await moduleFor('asset-appearance');
const {VARIANTS,VARIANT_CATEGORIES,VARIANT_BUNDLES}=await moduleFor('variant-catalogue');
const {loadAccessoryLibrary}=await moduleFor('asset-variants');
const {PART_CHOICES,displayedChoice}=await moduleFor('part-library');
assert.equal(PART_CHOICES.length,16);
for(const choice of PART_CHOICES)if(choice.thumbnail)assert.ok(fs.existsSync(path.join(app,'public/assets/m4a1/thumbnails',choice.thumbnail+'.png')),'Missing real part thumbnail: '+choice.thumbnail);
assert.equal(displayedChoice(SHOWCASE_ASSET,'stock',[]).id,'original','Missing artwork must use the original thumbnail');
assert.equal(displayedChoice(SHOWCASE_ASSET,'stock',['ctr']).thumbnail,'ctr');

const appearance={hiddenParts:['Magazine'],finishes:{Stock:'sand'}};
assert.deepEqual(readConceptExport(JSON.stringify({format:'armory-appearance',version:1,platform:'m4a1-exterior-study',config:DEFAULT})),DEFAULT);
assert.equal(readConceptExport(JSON.stringify({...assetExport(appearance)})),null);
assert.deepEqual(readAssetExport(JSON.stringify(assetExport(appearance))),appearance);
assert.ok(validAssetAppearance(DEFAULT_ASSET));
for(const invalid of [null,[],{}, {hiddenParts:['unknown'],finishes:{}}, {hiddenParts:['Stock','Stock'],finishes:{}}, {hiddenParts:[],finishes:{Stock:'unavailable'}}, {hiddenParts:[],finishes:[]}])assert.equal(validAssetAppearance(invalid),false);
for(const input of ['{','null','[]',JSON.stringify({...assetExport(appearance),version:999}),JSON.stringify({...assetExport(appearance),asset:'other'})])assert.equal(readAssetExport(input),null);
assert.equal(readAssetAppearances('{').length,0);
assert.equal(readAssetAppearances(JSON.stringify([{id:'valid',name:'Study',savedAt:'2026-09-05T00:00:00Z',appearance},{id:'bad',name:'',savedAt:'bad',appearance}])).length,1);

globalThis.self=globalThis;
globalThis.ProgressEvent=class{constructor(type,values){this.type=type;Object.assign(this,values);}};
let closed=0;
globalThis.ImageBitmap=class{constructor(width,height){this.width=width;this.height=height;}close(){closed++;}};
// This Node loader check reads embedded PNG metadata, not GPU pixels.
globalThis.createImageBitmap=async blob=>{const bytes=Buffer.from(await blob.arrayBuffer());assert.equal(bytes.toString('ascii',1,4),'PNG');return new ImageBitmap(bytes.readUInt32BE(16),bytes.readUInt32BE(20));};
const bytes=fs.readFileSync(path.join(app,'public',M4_ASSET.url));
assert.equal(bytes.readUInt32LE(8),bytes.length);
const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
assert.ok(json.images.every(image=>image.bufferView!==undefined&&!image.uri));
assert.ok(json.buffers.every(buffer=>!buffer.uri));
const {root,report}=await loadDisplayAsset('data:model/gltf-binary;base64,'+bytes.toString('base64'),16);
assert.deepEqual(report.nodes.slice().sort(),BASE_MODEL_PARTS.map(part=>part.id).sort());
assert.ok(report.triangles<150000,'Exterior mesh must stay within the web display budget');
assert.equal(report.textureSize,2048);
root.traverse(object=>{if(object.isMesh)assert.equal(object.parent,root);});
const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3());
assert.ok(Math.abs(size.x-7.4)<1e-5);
assert.ok(box.getCenter(new THREE.Vector3()).length()<1e-5);
const originalMaterial=root.getObjectByName('Stock').material;
assert.equal(originalMaterial.map.colorSpace,THREE.SRGBColorSpace);
assert.equal(originalMaterial.normalMap.colorSpace,THREE.NoColorSpace);
assert.equal(originalMaterial.roughnessMap.colorSpace,THREE.NoColorSpace);
const colorMap=originalMaterial.map,normalMap=originalMaterial.normalMap;
const materials=prepareAssetMaterials(root);
const stock=root.getObjectByName('Stock').material,base=root.getObjectByName('Base').material;
assert.notEqual(stock,base,'Per-part coatings cannot share their material instance');
assert.equal(stock.map,colorMap);assert.equal(stock.normalMap,normalMap);
const programs=[stock,base].map(material=>{
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  material.onBeforeCompile(shader,null);
  assert.ok(shader.fragmentShader.includes('coatingAlbedo'));
  assert.ok(shader.fragmentShader.includes('#include <normal_fragment_maps>'));
  return shader;
});
materials.apply(appearance);
assert.equal(programs[0].uniforms.armoryCoating.value,1);
assert.equal(programs[1].uniforms.armoryCoating.value,0);
materials.apply(DEFAULT_ASSET);
assert.equal(programs[0].uniforms.armoryCoating.value,0);
assert.equal(programs[0].uniforms.armoryDielectric.value,1,'Polymer stays nonmetallic under scratches');
assert.equal(programs[0].uniforms.armoryResponse.value.w,0,'Polymer has no metal substrate');
materials.apply({...DEFAULT_ASSET,wear:'weathered'});
assert.equal(programs[0].uniforms.armoryWear.value,.85);
materials.apply({...DEFAULT_ASSET,wear:'factory'});
assert.equal(programs[0].uniforms.armoryWear.value,0);
assert.equal(validAssetAppearance({...DEFAULT_ASSET,wear:'invalid'}),false);
assert.deepEqual(readAssetExport(JSON.stringify(assetExport({...SHOWCASE_ASSET,wear:'weathered'}))),{...SHOWCASE_ASSET,wear:'weathered'});
const classificationMesh=new THREE.Mesh();classificationMesh.userData.assetPart='Stock';
assert.equal(surfaceKind(classificationMesh,new THREE.MeshStandardMaterial({name:'Original soft rubber details'})),'rubber');
assert.equal(surfaceKind(classificationMesh,new THREE.MeshStandardMaterial({name:'Original decorative charcoal hardware'})),'metal');
classificationMesh.geometry.dispose();classificationMesh.material.dispose();
const edgeBox=new THREE.Mesh(new THREE.BoxGeometry(1,1,1)),edgePlane=new THREE.Mesh(new THREE.PlaneGeometry(1,1,2,2));
edgeBox.updateMatrixWorld(true);edgePlane.updateMatrixWorld(true);
const cubeData=prepareSurfaceGeometry(edgeBox),planeData=prepareSurfaceGeometry(edgePlane);
assert.equal(cubeData.userData.armoryConvexEdges,12,'Only the twelve convex box edges receive wear');
assert.equal(planeData.userData.armoryConvexEdges,0,'Coplanar diagonals and open boundaries must not receive wear');
for(const attribute of ['armoryPosition','armoryDirection','armoryEdgeDistance','armoryEdgeDistanceB']){
  assert.ok(Array.from(cubeData.getAttribute(attribute).array).every(Number.isFinite));
}
const boundSurface=Array.from(cubeData.getAttribute('armoryPosition').array);
edgeBox.geometry.dispose();edgeBox.geometry=cubeData;
edgeBox.position.set(5,2,1);edgeBox.rotation.y=1.2;edgeBox.updateMatrixWorld(true);
assert.deepEqual(Array.from(cubeData.getAttribute('armoryPosition').array),boundSurface,'Material coordinates must stay bound to moving geometry');
cubeData.dispose();planeData.dispose();edgePlane.geometry.dispose();edgeBox.material.dispose();edgePlane.material.dispose();
const seamMesh=new THREE.Mesh(new THREE.BoxGeometry(1,2,1));seamMesh.updateMatrixWorld(true);
const seamGeometry=prepareSurfaceGeometry(seamMesh);
function sampleEdge(i,j,t){
  return Math.min(...['armoryEdgeDistance','armoryEdgeDistanceB'].flatMap(name=>{
    const attribute=seamGeometry.getAttribute(name);
    return [0,1,2].map(channel=>THREE.MathUtils.lerp(attribute.getComponent(i,channel),attribute.getComponent(j,channel),t));
  }));
}
assert.ok(Math.abs(sampleEdge(1,2,.001)-sampleEdge(3,5,.001))<1e-8,'Both sides of an internal diagonal must agree on edge wear');
assert.ok(Math.abs(sampleEdge(1,2,.001)-.001)<1e-8);
seamGeometry.dispose();seamMesh.geometry.dispose();seamMesh.material.dispose();
const rest=new Map();root.traverse(object=>{if(object.isMesh)rest.set(object,object.position.clone());});
const layout=createDisplayLayout(root);layout.set(1);
assert.ok(root.getObjectByName('Stock').position.distanceTo(rest.get(root.getObjectByName('Stock')))>0);
layout.set(0);
rest.forEach((position,mesh)=>assert.ok(position.distanceTo(mesh.position)<1e-10,'Return to assembled display must preserve original transforms'));
const testGroup=new THREE.Group(),testVisible=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial()),testHidden=testVisible.clone();
testHidden.position.x=100;testHidden.visible=false;testGroup.add(testVisible,testHidden);
assert.ok(visibleDisplayBounds(testGroup).getSize(new THREE.Vector3()).x===1,'Hidden pieces must not affect the fit');
testVisible.geometry.dispose();testVisible.material.dispose();
let geometriesDisposed=0,materialsDisposed=0,texturesDisposed=0;
const materialSet=new Set(),textureSet=new Set(),bitmapSet=new Set();
root.traverse(object=>{if(object.isMesh){object.geometry.addEventListener('dispose',()=>geometriesDisposed++);for(const material of Array.isArray(object.material)?object.material:[object.material])materialSet.add(material);}});
materialSet.forEach(material=>{material.addEventListener('dispose',()=>materialsDisposed++);Object.values(material).forEach(value=>{if(value instanceof THREE.Texture){textureSet.add(value);bitmapSet.add(value.image);}});});
textureSet.forEach(texture=>texture.addEventListener('dispose',()=>texturesDisposed++));
disposeDisplayAsset(root);
assert.equal(geometriesDisposed,report.meshes);assert.equal(materialsDisposed,materialSet.size);assert.equal(texturesDisposed,textureSet.size);assert.equal(closed,bitmapSet.size);
console.log(JSON.stringify({status:'passed',meshes:report.meshes,triangles:report.triangles,textureSize:report.textureSize,checks:['appearance round trip','malformed data rejection','exact mesh IDs','embedded textures','display orientation','independent meshes','PBR color spaces','per-part shader uniforms','reversible display layout','resource cleanup'],gpuRendering:'not tested'},null,2));

assert.deepEqual(readAssetExport(JSON.stringify({...assetExport(appearance),version:1})),appearance,'Older exports retain original artwork');
assert.deepEqual(readAssetExport(JSON.stringify(assetExport(SHOWCASE_ASSET))),SHOWCASE_ASSET);
for(const invalid of [
  {...DEFAULT_ASSET,variants:{optic:'ctr'}},
  {...DEFAULT_ASSET,variants:{unknown:'hhs-viii'}},
  {...DEFAULT_ASSET,variants:[]},
  {...DEFAULT_ASSET,magnifierFlipped:'true'},
  {...DEFAULT_ASSET,wear:10},
])assert.equal(validAssetAppearance(invalid),false);
const dataURL=file=>'data:model/gltf-binary;base64,'+fs.readFileSync(path.join(app,'public',file)).toString('base64');
const full=(await loadDisplayAsset(dataURL(M4_ASSET.url),8)).root;
const library=await loadAccessoryLibrary(full,8,VARIANT_BUNDLES.map(dataURL));
assert.equal(library.warning,undefined);
assert.equal(library.controller.available.length,8);
const control=library.controller;
const fixed=full.getObjectByName('G33_Fixed_Mount'),pivot=full.getObjectByName('G33_Pivot');
assert.ok(fixed&&pivot,'The exported mount and pivot must exist');
assert.ok(pivot.children.length>0,'Moving geometry must remain below the pivot');
const optic=full.getObjectByName('HHS_VIII_Visual');
assert.equal(optic.parent,full,'Only the top-level accessory is attached to the normalized root');
const descendantBefore=new Map();optic.traverse(object=>descendantBefore.set(object,object.position.clone()));
control.apply(SHOWCASE_ASSET);
full.updateMatrixWorld(true);
const fixedRest=fixed.matrixWorld.clone();
control.flip(1);full.updateMatrixWorld(true);
assert.ok(fixed.matrixWorld.equals(fixedRest),'Flipping the G33 must leave its fixed mount stationary');
assert.ok(Math.abs(pivot.rotation.z+Math.PI/2)<1e-10);
const display=createDisplayLayout(full);display.set(1);
optic.traverse(object=>{if(object!==optic)assert.ok(object.position.distanceTo(descendantBefore.get(object))<1e-10,'Separating an accessory must preserve every child placement');});
display.set(0);control.flip(0);full.updateMatrixWorld(true);
assert.ok(fixed.matrixWorld.equals(fixedRest));
for(let mask=0;mask<256;mask++){
  const variants=Object.fromEntries(VARIANTS.filter((_,index)=>mask&(1<<index)).map(v=>[v.category,v.id]));
  control.apply({...DEFAULT_ASSET,variants});
  const replaced=new Set(VARIANTS.filter(v=>variants[v.category]===v.id).flatMap(v=>v.replaces));
  BASE_MODEL_PARTS.forEach(part=>assert.equal(full.getObjectByName(part.id).visible,!replaced.has(part.id)));
  VARIANTS.forEach(v=>assert.equal(full.getObjectByName(v.root).visible,variants[v.category]===v.id));
  const fit=visibleDisplayBounds(full);
  assert.ok(!fit.isEmpty()&&[...fit.min,...fit.max].every(Number.isFinite));
  assert.ok(fit.getSize(new THREE.Vector3()).length()<15,'Accessory exports must share the source display scale');
}
control.apply({...SHOWCASE_ASSET,hiddenParts:['Optic']});
assert.equal(isDisplayVisible(pivot.children[0]),false,'A hidden accessory must not remain selectable through its child meshes');
assert.ok(visibleDisplayBounds(full,'Optic').isEmpty(),'Hidden accessories must not produce a focus target');
control.apply(SHOWCASE_ASSET);
const coatings=prepareAssetMaterials(full);
coatings.apply({...SHOWCASE_ASSET,finishes:Object.fromEntries(VARIANT_CATEGORIES.map(c=>[c.part,'sand']))});
let preserved=0;
full.traverse(object=>{
  if(!object.isMesh||!object.userData.keepMaterial)return;
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
    const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
    material.onBeforeCompile(shader,null);
    assert.equal(shader.uniforms.armoryCoating,undefined,'Glass and markings must not receive cosmetic coatings');
    preserved++;
  }
});
assert.ok(preserved>0);
disposeDisplayAsset(full);
const partial=(await loadDisplayAsset(dataURL(M4_ASSET.url),1)).root;
const fallback=await loadAccessoryLibrary(partial,1,['data:model/gltf-binary;base64,AAAA',dataURL(VARIANT_BUNDLES[1])]);
assert.equal(fallback.controller.available.length,7);
assert.ok(fallback.warning);
fallback.controller.apply(SHOWCASE_ASSET);
assert.equal(partial.getObjectByName('Sight').visible,true,'Failed optic artwork must restore the original sight');
assert.equal(partial.getObjectByName('CTR_Stock').visible,true,'Independent successful accessories must remain usable');
disposeDisplayAsset(partial);
console.log(JSON.stringify({status:'passed',variants:8,combinations:256,preservedSurfaces:preserved,checks:['v1 save compatibility','v2 variant round trip','category validation','shared export coordinates','nested magnifier animation','fixed mount stability','grouped inspection layout','hidden ancestor filtering','glass and marking protection','partial-load fallback'],gpuRendering:'not tested'},null,2));
