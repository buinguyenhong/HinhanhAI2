import { createServer as createViteServer } from 'vite';
import app from './api/index';

const port = Number(process.env.PORT || 3000);

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  app.listen(port, '0.0.0.0', () => console.log(`HinhanhAI running on port ${port}`));
}

startServer();
