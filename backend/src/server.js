import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const port = Number(process.env.PORT || 3001);
const dbPath = process.env.DB_PATH
  ? path.resolve(process.cwd(), process.env.DB_PATH)
  : path.resolve(__dirname, '../data/obraneta.sqlite');
const autoSeed = process.env.AUTO_SEED !== 'false';

const { app, db } = createApp({
  dbPath,
  seed: autoSeed
});

const server = app.listen(port, () => {
  console.log(`ObraNeta API escuchando en http://localhost:${port}`);
  console.log(`Base de datos SQLite: ${dbPath}`);
});

function shutdown() {
  server.close(() => {
    try {
      db.close();
    } catch {
      // Ignorar si ya fue cerrada
    }
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

