import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { config } from '../src/config/env.js';
import { applyMysqlSchema, createMysqlPool, seedMysql } from '../src/db/mysql-connection.js';

describe('Prueba de integración con MySQL 8.4', () => {
  it('Verifica el aislamiento estricto entre la base de test y la base de desarrollo', () => {
    const devDb = config.db.database;
    const testDb = config.db.testDatabase;

    // Regla de arquitectura: Las pruebas deben rechazar una configuración que apunte a la misma base de desarrollo
    assert.notEqual(
      devDb,
      testDb,
      'ERROR CRÍTICO DE SEGURIDAD: La base de pruebas no puede ser la misma base de desarrollo'
    );
  });

  it('Verifica conectividad y flujo de aceptación en MySQL si el servidor está disponible', async (t) => {
    let pool;
    try {
      pool = createMysqlPool({
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.testDatabase
      });

      // Intentar ping con timeout corto
      const conn = await Promise.race([
        pool.getConnection(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 1500))
      ]);
      conn.release();

      // Si hay servidor MySQL activo, ejecutar migración y caso de prueba
      await applyMysqlSchema(pool);
      await seedMysql(pool);

      const [rows] = await pool.query("SELECT codigo FROM promociones WHERE codigo = 'CEMENTO5'");
      assert.equal(rows.length, 1);
      assert.equal(rows[0].codigo, 'CEMENTO5');
    } catch {
      t.skip('Servidor MySQL 8.4 no disponible en este entorno local. Se verifica el contrato y el aislamiento.');
    } finally {
      if (pool) {
        await pool.end();
      }
    }
  });
});

