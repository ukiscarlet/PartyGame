import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/PartyGame/',
  publicDir: 'public',
  build: {
    outDir: 'dist',
  },
});
