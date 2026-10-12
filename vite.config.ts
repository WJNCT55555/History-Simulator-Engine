import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectApi } from './editor/server';
const root=path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({base:'./',plugins:[react(),projectApi(root)],server:{host:'127.0.0.1',port:3000,open:false},esbuild:{target:'es2022'},optimizeDeps:{esbuildOptions:{target:'es2022'}},build:{target:'es2022',rollupOptions:{input:{player:path.join(root,'index.html'),studio:path.join(root,'editor/index.html')}}}});
