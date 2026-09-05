import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';

const basePath=process.env.NEXT_PUBLIC_BASE_PATH??'/armory-m4a1';
const output=resolve('dist/pages');
const html=readFileSync(join(output,'index.html'),'utf8');
assert.ok(html.includes('ARMORY'),'Static page must contain the actual workbench');
assert.ok(html.includes('thumbnail-callouts'),'Static page must include thumbnail slots');
const references=[...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match=>match[1].replaceAll('&amp;','&'));
const checked=new Set();
for(const reference of references){
  if(!reference.startsWith('/')||reference.startsWith('//'))continue;
  assert.ok(reference.startsWith(basePath+'/'),'Unprefixed Pages reference: '+reference);
  const pathname=decodeURIComponent(new URL(reference,'https://pages.example').pathname).slice(basePath.length);
  const file=join(output,pathname.endsWith('/')?pathname+'index.html':pathname);
  assert.ok(existsSync(file),'Missing published file: '+pathname);
  checked.add(pathname);
}
for(const asset of ['assets/studio.hdr','assets/materials/surface-detail.png','assets/m4a1/m4a1-blender-v2.glb','assets/m4a1/hhs-viii.glb','assets/m4a1/exterior-variants.glb','.nojekyll'])assert.ok(existsSync(join(output,asset)),asset);
const manifest=JSON.parse(readFileSync('dist/server/vinext-prerender.json','utf8'));
assert.ok(manifest.routes.some(route=>route.route==='/'&&route.status==='rendered'));
console.log(JSON.stringify({status:'passed',basePath,localHtmlReferences:checked.size,staticWorkbench:true}));
