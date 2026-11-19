import { defineConfig } from 'vite'

// 2 passes: content script must be single classic iife (no chunks/imports)
export default defineConfig(({ mode }) =>
  mode === 'content'
    ? {
        publicDir: false,
        build: {
          emptyOutDir: false,
          lib: { entry: 'src/content.ts', formats: ['iife'], name: 'rabbitHole', fileName: () => 'content.js' },
        },
      }
    : {
        build: {
          rollupOptions: {
            input: { popup: 'popup.html', offscreen: 'offscreen.html', sw: 'src/sw.ts' },
            output: { entryFileNames: '[name].js' },
          },
        },
      },
)
