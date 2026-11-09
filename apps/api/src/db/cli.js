import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase } from './connection.js';
import { applySchema } from './schema.js';
import { seedDatabase } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = process.env.DB_PATH
  ? path.resolve(process.cwd(), process.env.DB_PATH)
  : path.resolve(__dirname, '../../data/obraneta.sqlite');

const command = process.argv[2] || 'seed';

const db = createDatabase({
  dbPath: defaultDbPath,
  initialize: false,
  seed: false
});

if (command === 'init') {
  applySchema(db);
  console.log(`Esquema inicializado correctamente en: ${defaultDbPath}`);
} else if (command === 'seed') {
  applySchema(db);
  seedDatabase(db);
  console.log(`Esquema y semillas aplicadas correctamente en: ${defaultDbPath}`);
} else {
  console.error(`Comando desconocido: ${command}. Usa "init" o "seed".`);
  process.exit(1);
}

db.close();

