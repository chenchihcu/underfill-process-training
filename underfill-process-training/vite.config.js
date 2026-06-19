import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import packageJson from './package.json' with { type: 'json' };

function commitSha() {
  if (process.env.BUILD_COMMIT || process.env.GITHUB_SHA || process.env.COMMIT_REF) {
    return process.env.BUILD_COMMIT || process.env.GITHUB_SHA || process.env.COMMIT_REF;
  }
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'local-development';
  }
}

export default defineConfig({
  root: resolve(import.meta.dirname, 'src'),
  publicDir: resolve(import.meta.dirname, 'public'),
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __BUILD_COMMIT__: JSON.stringify(commitSha())
  },
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        training: resolve(import.meta.dirname, 'src/index.html'),
        simulation: resolve(import.meta.dirname, 'src/simulation.html')
      }
    }
  },
  test: {
    root: resolve(import.meta.dirname),
    environment: 'node',
    include: ['tests/unit/**/*.test.js']
  }
});
