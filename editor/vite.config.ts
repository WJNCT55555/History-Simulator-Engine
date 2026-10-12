import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs/promises';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

const projectRoot = path.resolve(__dirname, '..');
const draftPath = path.resolve(__dirname, 'saved-drafts/content-draft.json');
const cardOutputDirectories = {
  action_affairs: path.resolve(projectRoot, 'src/game/action_affairs'),
  government_affairs: path.resolve(projectRoot, 'src/game/government_affairs'),
  military_affairs: path.resolve(projectRoot, 'src/game/military_affairs'),
} as const;
const eventOutputDirectory = path.resolve(projectRoot, 'src/game/events');

const isGeneratedCardFilename = (value: unknown): value is string =>
  typeof value === 'string'
  && value.length <= 180
  && /\.generated\.(ts|tsx)$/.test(value)
  && path.basename(value) === value
  && !value.includes('..');

const isGeneratedEventFilename = (value: unknown): value is string =>
  typeof value === 'string'
  && value.length <= 180
  && /\.generated\.(ts|tsx)$/.test(value)
  && path.basename(value) === value
  && !value.includes('..');

const editorSavePlugin = (): Plugin => ({
  name: 'editor-save-draft',
  configureServer(server) {
    server.middlewares.use('/api/editor/save-draft', async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
      }

      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body);
          await fs.mkdir(path.dirname(draftPath), { recursive: true });
          await fs.writeFile(draftPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, path: draftPath }));
        } catch (error) {
          res.statusCode = 400;
          res.end(JSON.stringify({ ok: false, error: String(error) }));
        }
      });
    });

    server.middlewares.use('/api/editor/save-card-ts', async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
      }

      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 2_000_000) req.destroy();
      });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body) as { family?: keyof typeof cardOutputDirectories; filename?: unknown; content?: unknown };
          const outputDirectory = parsed.family ? cardOutputDirectories[parsed.family] : undefined;
          if (!outputDirectory || !isGeneratedCardFilename(parsed.filename) || typeof parsed.content !== 'string') {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: 'Invalid generated card payload.' }));
            return;
          }
          await fs.mkdir(outputDirectory, { recursive: true });
          const outputPath = path.resolve(outputDirectory, parsed.filename);
          if (path.dirname(outputPath) !== outputDirectory) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: 'Invalid output path.' }));
            return;
          }
          await fs.writeFile(outputPath, parsed.content, 'utf8');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, path: outputPath }));
        } catch (error) {
          res.statusCode = 400;
          res.end(JSON.stringify({ ok: false, error: String(error) }));
        }
      });
    });

    server.middlewares.use('/api/editor/save-event-ts', async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
      }

      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 2_000_000) req.destroy();
      });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body) as { filename?: unknown; content?: unknown };
          if (!isGeneratedEventFilename(parsed.filename) || typeof parsed.content !== 'string') {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: 'Invalid generated event payload.' }));
            return;
          }
          await fs.mkdir(eventOutputDirectory, { recursive: true });
          const outputPath = path.resolve(eventOutputDirectory, parsed.filename);
          if (path.dirname(outputPath) !== eventOutputDirectory) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: 'Invalid output path.' }));
            return;
          }
          await fs.writeFile(outputPath, parsed.content, 'utf8');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, path: outputPath }));
        } catch (error) {
          res.statusCode = 400;
          res.end(JSON.stringify({ ok: false, error: String(error) }));
        }
      });
    });
  },
});

export default defineConfig({
  root: __dirname,
  plugins: [react(), tailwindcss(), editorSavePlugin()],
  resolve: {
    alias: {
      '@game': path.resolve(projectRoot, 'src/game'),
      '@main-src': path.resolve(projectRoot, 'src'),
    },
  },
  server: {
    port: 3001,
    host: '0.0.0.0',
    fs: {
      allow: [projectRoot],
    },
  },
  build: {
    outDir: path.resolve(projectRoot, 'dist-editor'),
    emptyOutDir: true,
  },
});
