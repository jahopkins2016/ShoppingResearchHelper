import { build, context } from 'esbuild';
import { cpSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes('--watch');

// Clean dist
rmSync(resolve(__dirname, 'dist'), { recursive: true, force: true });

// Copy public/ to dist/
cpSync(resolve(__dirname, 'public'), resolve(__dirname, 'dist'), {
  recursive: true,
});

const buildOptions = {
  entryPoints: [
    resolve(__dirname, 'src/popup.ts'),
    resolve(__dirname, 'src/background.ts'),
    resolve(__dirname, 'src/content.ts'),
  ],
  bundle: true,
  format: 'iife',
  target: 'chrome116',
  outdir: resolve(__dirname, 'dist'),
  minify: !isWatch,
  sourcemap: isWatch ? 'inline' : false,
};

if (isWatch) {
  const ctx = await context(buildOptions);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await build(buildOptions);
  console.log('Build complete.');
}
