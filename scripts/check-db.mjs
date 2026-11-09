import { createMysqlPool } from '../backend/src/db/mysql-connection.js';
import { config } from '../backend/src/config/env.js';

async function check() {
  try {
    const pool = createMysqlPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database
    });

    const [rows] = await pool.query(`
      SELECT 
        DATABASE() AS base_datos,
        CURRENT_TIMESTAMP AS hora,
        (SELECT COUNT(*) FROM proveedores) AS total_proveedores,
        (SELECT COUNT(*) FROM articulos) AS total_articulos,
        (SELECT COUNT(*) FROM promociones) AS total_promociones
    `);

    console.log('\n===========================================');
    console.log('  ¡Conectado exitosamente a MySQL! ✅');
    console.log('===========================================');
    console.log(` Base de datos:  ${rows[0].base_datos}`);
    console.log(` Host / Puerto:  ${config.db.host}:${config.db.port}`);
    console.log(` Usuario:        ${config.db.user}`);
    console.log(` Proveedores:    ${rows[0].total_proveedores}`);
    console.log(` Artículos:      ${rows[0].total_articulos}`);
    console.log(` Promociones:    ${rows[0].total_promociones}`);
    console.log('===========================================\n');

    await pool.end();
  } catch (err) {
    console.error('\n❌ Error de conexión a MySQL:', err.message);
    console.error('Verifica que el servicio de MySQL esté corriendo y las credenciales en .env sean correctas.\n');
    process.exit(1);
  }
}

check();
