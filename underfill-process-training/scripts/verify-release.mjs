const urls = process.argv.slice(2).map((url) => url.replace(/\/$/,''));
if (urls.length !== 2) throw new Error('Usage: npm run verify:release -- <netlify-url> <pages-url>');

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function readJson(base, path, nonce) {
  const response = await fetch(`${base}/${path}?verify=${nonce}`, { headers:{'cache-control':'no-cache'} });
  if (!response.ok) throw new Error(`${base}/${path}: HTTP ${response.status}`);
  return response.json();
}

async function verifyOnce() {
  const nonce = Date.now();
  const releases = await Promise.all(urls.map(async (base) => ({ base, meta:await readJson(base,'build-meta.json',nonce), manifest:await readJson(base,'asset-manifest.json',nonce) })));
  const [primary,mirror] = releases;
  for (const key of ['commit','specVersion','artifactHash','appVersion']) {
    if (primary.meta[key] !== mirror.meta[key]) throw new Error(`Release mismatch for ${key}: ${primary.meta[key]} vs ${mirror.meta[key]}`);
  }
  if (primary.meta.artifactHash !== primary.manifest.artifactHash || mirror.meta.artifactHash !== mirror.manifest.artifactHash) throw new Error('A host serves inconsistent build metadata.');
  for (const release of releases) {
    for (const route of ['index.html','simulation.html','sw.js']) {
      const response = await fetch(`${release.base}/${route}?verify=${nonce}`, { headers:{'cache-control':'no-cache'} });
      if (!response.ok) throw new Error(`${release.base}/${route}: HTTP ${response.status}`);
    }
  }
  return primary.meta;
}

let lastError;
for (let attempt=1; attempt<=12; attempt+=1) {
  try {
    const metadata = await verifyOnce();
    console.log(`Release parity verified: ${metadata.artifactHash.slice(0,16)} on both hosts.`);
    process.exit(0);
  } catch (error) {
    lastError = error;
    if (attempt < 12) {
      console.log(`Release not yet converged (${attempt}/12): ${error.message}`);
      await wait(10_000);
    }
  }
}
throw lastError;
