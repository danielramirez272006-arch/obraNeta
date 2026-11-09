export class ReportesRepository {
  /**
   * @param {import('node:sqlite').DatabaseSync} db
   */
  constructor(db) {
    this.db = db;
  }

  obtenerAhorrosPorProveedor({ mes = null } = {}) {
    if (mes) {
      return this.db
        .prepare(`
          SELECT
            p.id AS proveedorId,
            p.codigo AS proveedorCodigo,
            p.nombre AS proveedorNombre,
            ? AS mes,
            COUNT(o.id) AS cantidadOrdenes,
            COALESCE(SUM(o.subtotal), 0) AS subtotalTotal,
            COALESCE(SUM(o.ahorro_total), 0) AS ahorroTotal,
            COALESCE(SUM(o.ahorro_total), 0) AS ahorro,
            COALESCE(SUM(o.total_neto), 0) AS totalNeto
          FROM proveedores p
          JOIN ordenes_compra o
            ON o.proveedor_id = p.id
           AND substr(o.fecha_oc, 1, 7) = ?
          GROUP BY p.id, p.codigo, p.nombre
          ORDER BY ahorroTotal DESC, p.nombre ASC
        `)
        .all(mes, mes);
    }

    return this.db
      .prepare(`
        SELECT
          p.id AS proveedorId,
          p.codigo AS proveedorCodigo,
          p.nombre AS proveedorNombre,
          substr(o.fecha_oc, 1, 7) AS mes,
          COUNT(o.id) AS cantidadOrdenes,
          COALESCE(SUM(o.subtotal), 0) AS subtotalTotal,
          COALESCE(SUM(o.ahorro_total), 0) AS ahorroTotal,
          COALESCE(SUM(o.ahorro_total), 0) AS ahorro,
          COALESCE(SUM(o.total_neto), 0) AS totalNeto
        FROM ordenes_compra o
        JOIN proveedores p ON p.id = o.proveedor_id
        GROUP BY p.id, p.codigo, p.nombre, substr(o.fecha_oc, 1, 7)
        ORDER BY mes DESC, ahorroTotal DESC, p.nombre ASC
      `)
      .all();
  }

  obtenerPromocionesVigentesSinUso({ fecha }) {
    const filas = this.db
      .prepare(`
        SELECT
          p.id,
          p.proveedor_id AS proveedorId,
          pr.codigo AS proveedorCodigo,
          pr.nombre AS proveedorNombre,
          p.codigo,
          p.nombre,
          p.tipo,
          p.tasa_bps AS tasaBps,
          p.monto_fijo AS montoFijo,
          p.fecha_inicio AS fechaInicio,
          p.fecha_fin AS fechaFin,
          p.prioridad,
          p.monto_minimo AS montoMinimo,
          p.categoria_id AS categoriaId,
          c.codigo AS categoriaCodigo,
          c.nombre AS categoriaNombre,
          p.articulo_id AS articuloId,
          a.sku AS sku,
          a.nombre AS articuloNombre
        FROM promociones p
        JOIN proveedores pr ON pr.id = p.proveedor_id
        LEFT JOIN categorias c ON c.id = p.categoria_id
        LEFT JOIN articulos a ON a.id = p.articulo_id
        WHERE p.fecha_inicio <= ?
          AND p.fecha_fin >= ?
          AND NOT EXISTS (
            SELECT 1
            FROM ordenes_compra o
            WHERE o.fecha_oc <= ?
              AND (
                o.promocion_aplicada_id = p.id
                OR (o.proveedor_id = p.proveedor_id AND o.codigo_promocion_aplicada = p.codigo)
              )
          )
        ORDER BY p.proveedor_id ASC, p.prioridad DESC, p.codigo ASC
      `)
      .all(fecha, fecha, fecha);

    const obtenerTramos = this.db.prepare(`
      SELECT
        id,
        promocion_id AS promocionId,
        cantidad_minima AS cantidadMinima,
        tasa_bps AS tasaBps
      FROM promocion_tramos
      WHERE promocion_id = ?
      ORDER BY cantidad_minima ASC
    `);

    return filas.map((promo) => ({
      ...promo,
      tramos: obtenerTramos.all(promo.id)
    }));
  }
}

