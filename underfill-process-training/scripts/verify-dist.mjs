import { readFile, readdir } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
const root = resolve(import.meta.dirname,'..','dist');
const required = ['index.html','simulation.html','manifest.webmanifest','asset-manifest.json','build-meta.json','sw.js','_headers'];
for (const file of required) await readFile(resolve(root,file));
const metadata = JSON.parse(await readFile(resolve(root,'build-meta.json'),'utf8'));
const manifest = JSON.parse(await readFile(resolve(root,'asset-manifest.json'),'utf8'));
if (metadata.artifactHash !== manifest.artifactHash) throw new Error('Build metadata and asset manifest hashes differ.');
async function walk(directory) { const output=[]; for(const entry of await readdir(directory,{withFileTypes:true})){const path=resolve(directory,entry.name); if(entry.isDirectory()) output.push(...await walk(path)); else output.push(path);} return output; }
for (const path of await walk(root)) {
  if (!['.html','.js','.css','.json','.map','.webmanifest'].includes(extname(path)) && !path.endsWith('.webmanifest')) continue;
  const content = await readFile(path,'utf8');
  if (/dashboard\//i.test(content)) throw new Error(`Stale dashboard reference in ${path}`);
  const corrupt = new RegExp([0xfffd,0x92c6,0x95ae,0x8761,0x645e,0x8a28,0x96de,0x9903,0x5697].map((code) => String.fromCodePoint(code)).join('|'),'u');
  if (corrupt.test(content)) throw new Error(`Encoding corruption in ${path}`);
}
console.log(`Distribution verified: ${manifest.artifactHash.slice(0,16)} (${Object.keys(manifest.files).length} files).`);
