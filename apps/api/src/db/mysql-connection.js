import mysql from 'mysql2/promise';
import { MYSQL_SCHEMA_SQL } from './mysql-schema.js';

/**
 * Crea un pool de conexiones MySQL 8.4 configurado para fechas tipo YYYY-MM-DD.
 * @param {object} options
 */
export function createMysqlPool(options = {}) {
  return mysql.createPool({
    host: options.host || 'localhost',
    port: options.port || 3306,
    user: options.user || 'obraneta_user',
    password: options.password || 'obraneta_password',
    database: options.database || 'obraneta',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true, // Convierte DATE a cadenas YYYY-MM-DD automáticamente
    charset: 'utf8mb4'
  });
}

/**
 * Aplica el esquema MySQL ejecutando las sentencias DDL.
 */
export async function applyMysqlSchema(pool) {
  const statements = MYSQL_SCHEMA_SQL
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const connection = await pool.getConnection();
  try {
    for (const sql of statements) {
      await connection.query(sql);
    }
  } finally {
    connection.release();
  }
}

/**
 * Carga semillas idempotentes en MySQL.
 */
export async function seedMysql(pool) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Proveedores
    await conn.query(`
      INSERT INTO proveedores (codigo, nombre)
      VALUES ('PROV-A', 'Proveedor A'), ('PROV-B', 'Proveedor B - Aceros y Materiales')
      ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)
    `);

    const [[provA]] = await conn.query('SELECT id FROM proveedores WHERE codigo = ?', ['PROV-A']);
    const [[provB]] = await conn.query('SELECT id FROM proveedores WHERE codigo = ?', ['PROV-B']);

    // Categorías
    await conn.query(`
      INSERT INTO categorias (codigo, nombre)
      VALUES 
        ('CEMENTO', 'Cemento y Morteros'),
        ('ACERO', 'Acero y Varillas'),
        ('MAMPOSTERIA', 'Bloques y Mampostería')
      ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)
    `);

    const [[catCemento]] = await conn.query('SELECT id FROM categorias WHERE codigo = ?', ['CEMENTO']);
    const [[catAcero]] = await conn.query('SELECT id FROM categorias WHERE codigo = ?', ['ACERO']);
    const [[catMamposteria]] = await conn.query('SELECT id FROM categorias WHERE codigo = ?', ['MAMPOSTERIA']);

    // Artículos
    await conn.query(`
      INSERT INTO articulos (sku, nombre, categoria_id, unidad, precio_sugerido)
      VALUES 
        ('CEM-GRIS-50', 'Cemento gris de 50 kg', ?, 'saco', 6300),
        ('MOR-PEGA-25', 'Mortero pega bloque 25 kg', ?, 'saco', 4500),
        ('VAR-CORR-38', 'Varilla corrugada #3 (3/8 pulg)', ?, 'varilla', 4200),
        ('BLOQ-EST-15', 'Bloque estructural 15x20x40 cm', ?, 'unidad', 750)
      ON DUPLICATE KEY UPDATE 
        nombre = VALUES(nombre),
        categoria_id = VALUES(categoria_id),
        unidad = VALUES(unidad),
        precio_sugerido = VALUES(precio_sugerido)
    `, [catCemento.id, catCemento.id, catAcero.id, catMamposteria.id]);

    const [[artCemento]] = await conn.query('SELECT id FROM articulos WHERE sku = ?', ['CEM-GRIS-50']);
    const [[artVarilla]] = await conn.query('SELECT id FROM articulos WHERE sku = ?', ['VAR-CORR-38']);
    const [[artBloque]] = await conn.query('SELECT id FROM articulos WHERE sku = ?', ['BLOQ-EST-15']);

    // Promociones Proveedor A (Caso de aceptación)
    await conn.query(`
      INSERT INTO promociones (
        proveedor_id, codigo, nombre, tipo, tasa_bps, monto_fijo,
        fecha_inicio, fecha_fin, prioridad, monto_minimo, categoria_id, articulo_id
      )
      VALUES 
        (?, 'CEMENTO5', 'Descuento 5% en Cemento Gris 50 kg', 'PORCENTAJE', 500, NULL, '2026-10-01', '2026-10-31', 10, 0, NULL, ?),
        (?, 'FIJO50000', 'Bono fijo de ₡50 000 por compras desde ₡1 000 000', 'MONTO_FIJO', NULL, 50000, '2026-10-01', '2026-10-31', 5, 1000000, NULL, NULL),
        (?, 'CEMENTO10', 'Promoción Septiembre 10% en Cemento Gris 50 kg', 'PORCENTAJE', 1000, NULL, '2026-09-01', '2026-09-30', 10, 0, NULL, ?)
      ON DUPLICATE KEY UPDATE
        nombre = VALUES(nombre),
        tipo = VALUES(tipo),
        tasa_bps = VALUES(tasa_bps),
        monto_fijo = VALUES(monto_fijo),
        fecha_inicio = VALUES(fecha_inicio),
        fecha_fin = VALUES(fecha_fin),
        prioridad = VALUES(prioridad),
        monto_minimo = VALUES(monto_minimo),
        categoria_id = VALUES(categoria_id),
        articulo_id = VALUES(articulo_id)
    `, [
      provA.id, artCemento.id,
      provA.id,
      provA.id, artCemento.id
    ]);

    // Promociones Proveedor B (ESCALONADO y DOS_POR_UNO)
    await conn.query(`
      INSERT INTO promociones (
        proveedor_id, codigo, nombre, tipo, tasa_bps, monto_fijo,
        fecha_inicio, fecha_fin, prioridad, monto_minimo, categoria_id, articulo_id
      )
      VALUES 
        (?, 'ESCALA-VARILLA', 'Descuento escalonado por volumen en Varilla #3', 'ESCALONADO', NULL, NULL, '2026-11-01', '2026-12-31', 8, 0, ?, ?),
        (?, '2X1-BLOQUES', 'Promoción 2×1 en Bloque Estructural 15 cm', 'DOS_POR_UNO', NULL, NULL, '2026-11-01', '2026-12-31', 6, 0, ?, ?)
      ON DUPLICATE KEY UPDATE
        nombre = VALUES(nombre),
        tipo = VALUES(tipo),
        fecha_inicio = VALUES(fecha_inicio),
        fecha_fin = VALUES(fecha_fin),
        prioridad = VALUES(prioridad),
        categoria_id = VALUES(categoria_id),
        articulo_id = VALUES(articulo_id)
    `, [
      provB.id, catAcero.id, artVarilla.id,
      provB.id, catMamposteria.id, artBloque.id
    ]);

    const [[promoEscala]] = await conn.query('SELECT id FROM promociones WHERE proveedor_id = ? AND codigo = ?', [provB.id, 'ESCALA-VARILLA']);
    await conn.query('DELETE FROM promocion_tramos WHERE promocion_id = ?', [promoEscala.id]);
    await conn.query(`
      INSERT INTO promocion_tramos (promocion_id, cantidad_minima, tasa_bps)
      VALUES (?, 50, 400), (?, 100, 800), (?, 200, 1200)
    `, [promoEscala.id, promoEscala.id, promoEscala.id]);

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
