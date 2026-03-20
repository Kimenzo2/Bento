import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['three', 'three/webgpu'],
      output: {
        preserveModules: false,
      },
    },
    target: 'esnext',
    minify: false,
    sourcemap: true,
  },
  // Worker bundling configuration
  worker: {
    format: 'es',
    plugins: () => [],
  },
});
