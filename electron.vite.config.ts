import { resolve } from 'path';
import { defineConfig } from 'electron-vite';

// Dependencies are bundled rather than externalized: the packaged app ships only `out/` (see electron-builder.yml).
export default defineConfig({
    main: {
        build: {
            externalizeDeps: false,
            rollupOptions: {
                input: resolve(__dirname, 'src/main/main.ts'),
            },
        },
    },
    preload: {
        build: {
            externalizeDeps: false,
            rollupOptions: {
                input: resolve(__dirname, 'src/preload/preload.ts'),
            },
        },
    },
    renderer: {
        root: '.',
        build: {
            rollupOptions: {
                input: resolve(__dirname, 'index.html'),
            },
        },
    },
});
