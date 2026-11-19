import { defineConfig, loadEnv } from 'vite';
import { createApiMiddleware } from './config/api-middleware.js';

function apiDevServer() {
  const middleware = createApiMiddleware({ apiDir: new URL('./api/', import.meta.url) });

  return {
    name: 'vyrnn-api-dev-server',
    config(_, { mode }) {
      const env = loadEnv(mode, process.cwd(), '');
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }
    },
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  plugins: [apiDevServer()],
});
