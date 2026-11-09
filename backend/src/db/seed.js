/**
 * Semillas idempotentes para ObraNeta (Constructora Del Valle S.A.).
 * Puede ejecutarse múltiples veces sin duplicar registros ni borrar órdenes de compra.
 */
export function seedDatabase(db) {
  db.exec('BEGIN IMMEDIATE TRANSACTION;');
  try {
    // 1. Proveedores
    const upsertProveedor = db.prepare(`
      INSERT INTO proveedores (codigo, nombre)
      VALUES (?, ?)
      ON CONFLICT(codigo) DO UPDATE SET nombre = excluded.nombre
    `);
    upsertProveedor.run('PROV-A', 'Proveedor A');
    upsertProveedor.run('PROV-B', 'Proveedor B - Aceros y Materiales');

    const getProveedorId = db.prepare('SELECT id FROM proveedores WHERE codigo = ?');
    const provA = getProveedorId.get('PROV-A').id;
    const provB = getProveedorId.get('PROV-B').id;

    // 2. Categorías
    const upsertCategoria = db.prepare(`
      INSERT INTO categorias (codigo, nombre)
      VALUES (?, ?)
      ON CONFLICT(codigo) DO UPDATE SET nombre = excluded.nombre
    `);
    upsertCategoria.run('CEMENTO', 'Cemento y Morteros');
    upsertCategoria.run('ACERO', 'Acero y Varillas');
    upsertCategoria.run('MAMPOSTERIA', 'Bloques y Mampostería');

    const getCategoriaId = db.prepare('SELECT id FROM categorias WHERE codigo = ?');
    const catCemento = getCategoriaId.get('CEMENTO').id;
    const catAcero = getCategoriaId.get('ACERO').id;
    const catMamposteria = getCategoriaId.get('MAMPOSTERIA').id;

    // 3. Artículos
    const upsertArticulo = db.prepare(`
      INSERT INTO articulos (sku, nombre, categoria_id, unidad, precio_sugerido)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(sku) DO UPDATE SET
        nombre = excluded.nombre,
        categoria_id = excluded.categoria_id,
        unidad = excluded.unidad,
        precio_sugerido = excluded.precio_sugerido
    `);
    upsertArticulo.run('CEM-GRIS-50', 'Cemento gris de 50 kg', catCemento, 'saco', 6300);
    upsertArticulo.run('MOR-PEGA-25', 'Mortero pega bloque 25 kg', catCemento, 'saco', 4500);
    upsertArticulo.run('VAR-CORR-38', 'Varilla corrugada #3 (3/8 pulg)', catAcero, 'varilla', 4200);
    upsertArticulo.run('BLOQ-EST-15', 'Bloque estructural 15x20x40 cm', catMamposteria, 'unidad', 750);

    const getArticuloId = db.prepare('SELECT id FROM articulos WHERE sku = ?');
    const artCemento = getArticuloId.get('CEM-GRIS-50').id;
    const artVarilla = getArticuloId.get('VAR-CORR-38').id;
    const artBloque = getArticuloId.get('BLOQ-EST-15').id;

    // 4. Promociones del Caso de Aceptación Obligatorio (Proveedor A)
    const upsertPromocion = db.prepare(`
      INSERT INTO promociones (
        proveedor_id, codigo, nombre, tipo, tasa_bps, monto_fijo,
        fecha_inicio, fecha_fin, prioridad, monto_minimo, categoria_id, articulo_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(proveedor_id, codigo) DO UPDATE SET
        nombre = excluded.nombre,
        tipo = excluded.tipo,
        tasa_bps = excluded.tasa_bps,
        monto_fijo = excluded.monto_fijo,
        fecha_inicio = excluded.fecha_inicio,
        fecha_fin = excluded.fecha_fin,
        prioridad = excluded.prioridad,
        monto_minimo = excluded.monto_minimo,
        categoria_id = excluded.categoria_id,
        articulo_id = excluded.articulo_id
    `);

    // CEMENTO5: 5 % sobre el SKU CEM-GRIS-50. Vigencia 2026-10-01 al 2026-10-31.
    upsertPromocion.run(
      provA,
      'CEMENTO5',
      'Descuento 5% en Cemento Gris 50 kg',
      'PORCENTAJE',
      500,
      null,
      '2026-10-01',
      '2026-10-31',
      10,
      0,
      null,
      artCemento
    );

    // FIJO50000: ₡50 000 con un subtotal mínimo de ₡1 000 000. Vigencia 2026-10-01 al 2026-10-31.
    upsertPromocion.run(
      provA,
      'FIJO50000',
      'Bono fijo de ₡50 000 por compras desde ₡1 000 000',
      'MONTO_FIJO',
      null,
      50000,
      '2026-10-01',
      '2026-10-31',
      5,
      1000000,
      null,
      null
    );

    // CEMENTO10: 10 % sobre el SKU CEM-GRIS-50. Vigencia 2026-09-01 al 2026-09-30.
    upsertPromocion.run(
      provA,
      'CEMENTO10',
      'Promoción Septiembre 10% en Cemento Gris 50 kg',
      'PORCENTAJE',
      1000,
      null,
      '2026-09-01',
      '2026-09-30',
      10,
      0,
      null,
      artCemento
    );

    // 5. Promociones de muestra para completar los 4 tipos de promoción (Proveedor B)
    // ESCALONADO: sobre SKU VAR-CORR-38 (vigencia noviembre-diciembre 2026)
    upsertPromocion.run(
      provB,
      'ESCALA-VARILLA',
      'Descuento escalonado por volumen en Varilla #3',
      'ESCALONADO',
      null,
      null,
      '2026-11-01',
      '2026-12-31',
      8,
      0,
      catAcero,
      artVarilla
    );

    const promoEscalaId = db
      .prepare('SELECT id FROM promociones WHERE proveedor_id = ? AND codigo = ?')
      .get(provB, 'ESCALA-VARILLA').id;

    db.prepare('DELETE FROM promocion_tramos WHERE promocion_id = ?').run(promoEscalaId);
    const insertTramo = db.prepare(`
      INSERT INTO promocion_tramos (promocion_id, cantidad_minima, tasa_bps)
      VALUES (?, ?, ?)
    `);
    insertTramo.run(promoEscalaId, 50, 400);   // 50+ uds -> 4%
    insertTramo.run(promoEscalaId, 100, 800);  // 100+ uds -> 8%
    insertTramo.run(promoEscalaId, 200, 1200); // 200+ uds -> 12%

    // DOS_POR_UNO: sobre SKU BLOQ-EST-15 (vigencia noviembre-diciembre 2026)
    upsertPromocion.run(
      provB,
      '2X1-BLOQUES',
      'Promoción 2×1 en Bloque Estructural 15 cm',
      'DOS_POR_UNO',
      null,
      null,
      '2026-11-01',
      '2026-12-31',
      6,
      0,
      catMamposteria,
      artBloque
    );

    db.exec('COMMIT;');
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // Ignorar si ya fue revertida
    }
    throw error;
  }
}

