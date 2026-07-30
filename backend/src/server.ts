import { createApp } from './app';
import { connectDatabase } from './config/db';
import { env } from './config/env';

const app = createApp();

async function bootstrap() {
  await connectDatabase();
  app.listen(env.port, () => {
    console.log(`API running on http://localhost:${env.port}`);
  });
}

// Local / traditional host: listen on a port
// Vercel Express runtime: export the app (no listen)
if (!process.env.VERCEL) {
  bootstrap().catch((err) => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
}

export default app;
