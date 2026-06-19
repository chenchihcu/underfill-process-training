import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import packageJson from '../package.json' with { type: 'json' };
import spec from '../src/data/process-spec.v1.json' with { type: 'json' };

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
function commitSha() {
  if (process.env.BUILD_COMMIT || process.env.GITHUB_SHA || process.env.COMMIT_REF) return process.env.BUILD_COMMIT || process.env.GITHUB_SHA || process.env.COMMIT_REF;
  try { return execFileSync('git', ['rev-parse','HEAD'], { encoding:'utf8', cwd:root }).trim(); } catch { return 'local-development'; }
}
async function files(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes:true })) {
    const path = resolve(directory,entry.name);
    if (entry.isDirectory()) output.push(...await files(path)); else output.push(path);
  }
  return output;
}
const targets = (await files(dist)).filter((path) => !['sw.js','asset-manifest.json','build-meta.json'].includes(relative(dist,path).replaceAll('\\','/'))).sort();
const manifestFiles = {};
for (const path of targets) manifestFiles[relative(dist,path).replaceAll('\\','/')] = createHash('sha256').update(await readFile(path)).digest('hex');
const artifactHash = createHash('sha256').update(JSON.stringify(manifestFiles)).digest('hex');
const manifest = { schemaVersion:1, artifactHash, files:manifestFiles };
const metadata = { appVersion:packageJson.version, commit:commitSha(), specVersion:spec.metadata.specVersion, artifactHash };
await writeFile(resolve(dist,'asset-manifest.json'), JSON.stringify(manifest,null,2) + '\n');
await writeFile(resolve(dist,'build-meta.json'), JSON.stringify(metadata,null,2) + '\n');
await writeFile(resolve(dist,'_headers'), '/build-meta.json\n  Cache-Control: no-store\n/asset-manifest.json\n  Cache-Control: no-store\n/sw.js\n  Cache-Control: no-cache\n');
const precache = [...Object.keys(manifestFiles), 'asset-manifest.json','build-meta.json'].map((path) => `./${path}`);
const serviceWorker = `const CACHE = 'underfill-${artifactHash.slice(0,16)}';\nconst PRECACHE = ${JSON.stringify(precache)};\nself.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE))); });\nself.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('underfill-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });\nself.addEventListener('fetch', event => {\n  if (event.request.method !== 'GET') return;\n  if (event.request.mode === 'navigate') {\n    event.respondWith(fetch(event.request).then(response => { const copy=response.clone(); caches.open(CACHE).then(cache=>cache.put(event.request,copy)); return response; }).catch(() => caches.match(event.request,{ignoreVary:true}).then(hit => hit || caches.match('./index.html',{ignoreVary:true}))));\n    return;\n  }\n  const url = new URL(event.request.url);\n  if (url.origin !== self.location.origin) return;\n  if (url.pathname.includes('/assets/')) event.respondWith(caches.match(event.request,{ignoreVary:true}).then(hit => hit || fetch(event.request).then(response => { const copy=response.clone(); caches.open(CACHE).then(cache=>cache.put(event.request,copy)); return response; })));\n  else event.respondWith(fetch(event.request).catch(() => caches.match(event.request,{ignoreVary:true})));\n});\n`;
await writeFile(resolve(dist,'sw.js'), serviceWorker);
console.log(`Built immutable artifact ${artifactHash.slice(0,16)} for ${metadata.commit.slice(0,8)}.`);
