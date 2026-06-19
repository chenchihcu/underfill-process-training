import { readdir, readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const directories = ['src', 'scripts', 'tests'];
const textExtensions = new Set(['.html','.css','.js','.mjs','.json','.md','.yml','.yaml','.webmanifest','.svg']);
const corruptPatterns = [new RegExp(String.fromCodePoint(0xfffd), 'u'), new RegExp([0x92c6,0x95ae,0x8761,0x645e,0x8a28,0x96de,0x9903,0x5697].map((code) => String.fromCodePoint(code)).join('|'), 'u')];
const failures = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (textExtensions.has(extname(entry.name)) || entry.name.endsWith('.webmanifest')) {
      const content = await readFile(path, 'utf8');
      if (corruptPatterns.some((pattern) => pattern.test(content))) failures.push(path);
      if (/\?\?[A-Za-z\u4E00-\u9FFF]/u.test(content) && !['.js','.mjs'].includes(extname(entry.name))) failures.push(`${path} (suspicious placeholder)`);
    }
  }
}
for (const directory of directories) await walk(resolve(root, directory));
if (failures.length) { console.error('Encoding gate failed:\n' + failures.join('\n')); process.exit(1); }
console.log('Encoding gate passed.');
