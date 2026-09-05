import { spawnSync } from 'node:child_process';
import { writeFileSync, existsSync, cpSync, mkdirSync, readFileSync, rmSync, realpathSync, lstatSync } from 'node:fs';
import { resolve, join } from 'node:path';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/armory-m4a1';
if (basePath && (!/^\/[a-zA-Z0-9_.-]+$/.test(basePath)||['/.','/..'].includes(basePath))) throw new Error('Use an empty Pages base path or one repository path.');
const preload = ['--require',resolve('scripts/pages-prerender-compat.cjs')];
const result = spawnSync(process.execPath, [...preload,'node_modules/vinext/dist/cli.js', 'build'], {
  stdio: 'inherit',
  timeout: 120000,
  env: { ...process.env, ARMORY_PAGES: '1', NEXT_PUBLIC_BASE_PATH: basePath },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
if (!existsSync('dist/client/index.html')) throw new Error('Pages export did not produce index.html.');
const manifest=JSON.parse(readFileSync('dist/server/vinext-prerender.json','utf8'));
if (!manifest.routes.some(route=>route.route==='/'&&route.status==='rendered')) throw new Error('The workbench route was not prerendered.');
const output=resolve('dist/pages');
const generatedRoot=realpathSync(resolve('dist'));
if (generatedRoot.toLowerCase()!==join(realpathSync('.'),'dist').toLowerCase()) throw new Error('Refusing to stage outside this project.');
if (existsSync(output)) {
  if (lstatSync(output).isSymbolicLink()||realpathSync(output).toLowerCase()!==join(generatedRoot,'pages').toLowerCase()) throw new Error('Refusing to clear a redirected staging directory.');
  rmSync(output,{recursive:true});
}
mkdirSync(output,{recursive:true});
// The repository URL prefix is provided by GitHub, so remove that one disk
// prefix from emitted compiled assets while preserving it in their URLs.
const nestedCompiled=basePath?resolve('dist/client',basePath.slice(1),'_next'):null;
const excluded=new Set([resolve('dist/client/.vite'),resolve('dist/client/vinext-client-entry-manifest.json'),nestedCompiled]);
cpSync('dist/client',output,{recursive:true,filter:source=>!excluded.has(resolve(source))});
if (nestedCompiled&&existsSync(nestedCompiled)) cpSync(nestedCompiled,join(output,'_next'),{recursive:true});
writeFileSync(join(output,'.nojekyll'), '');
console.log('GitHub Pages static files are ready in dist/pages.');
