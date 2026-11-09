import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from './schema.js';
import { seedDatabase } from './seed.js';

/**
 * Abre o crea una conexión SQLite con claves foráneas habilitadas.
 * @param {object} options
 * @param {string} [options.dbPath] Ruta del archivo SQLite o ':memory:'
 * @param {boolean} [options.initialize=true] Si debe crear las tablas
 * @param {boolean} [options.seed=true] Si debe cargar las semillas iniciales
 * @returns {DatabaseSync}
 */
export function createDatabase({ dbPath = ':memory:', initialize = true, seed = true } = {}) {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(path.resolve(dbPath));
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');

  if (initialize) {
    applySchema(db);
  }

  if (seed) {
    seedDatabase(db);
  }

  return db;
}

/**
 * Ejecuta una función dentro de una transacción atómica SQLite.
 * Si ocurre un error, revierte todos los cambios automáticamente.
 * @template T
 * @param {DatabaseSync} db
 * @param {() => T} fn
 * @returns {T}
 */
export function runInTransaction(db, fn) {
  db.exec('BEGIN IMMEDIATE TRANSACTION;');
  try {
    const result = fn();
    db.exec('COMMIT;');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // Ignorar si ya fue revertida por SQLite
    }
    throw error;
  }
}

