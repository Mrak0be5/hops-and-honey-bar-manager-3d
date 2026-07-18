import { defineConfig } from 'vite';
import { sites } from './build/sites-vite-plugin';

const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

export default defineConfig(async ({ command }) => {
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  const productionPlugins = [];

  if (command === 'build') {
    const { cloudflare } = await import('@cloudflare/vite-plugin');
    productionPlugins.push(
      cloudflare({
        viteEnvironment: { name: 'server' },
        config: {
          main: './worker/index.ts',
          compatibility_date: '2026-05-22',
          assets: {
            binding: 'ASSETS',
            not_found_handling: 'single-page-application',
            run_worker_first: true,
          },
        },
      }),
    );
  }

  return {
    base: './',
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      sites(),
      ...productionPlugins,
    ],
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  };
});
