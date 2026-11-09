import { runInTransaction } from '../../db/connection.js';

export class PromocionesRepository {
  /**
   * @param {import('node:sqlite').DatabaseSync} db
   */
  constructor(db) {
    this.db = db;
  }

  listar({ proveedorId = null } = {}) {
    let sql = `
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
        a.nombre AS articuloNombre,
        p.creado_en AS creadoEn
      FROM promociones p
      JOIN proveedores pr ON pr.id = p.proveedor_id
      LEFT JOIN categorias c ON c.id = p.categoria_id
      LEFT JOIN articulos a ON a.id = p.articulo_id
    `;
    const params = [];
    if (proveedorId !== null && proveedorId !== undefined && proveedorId !== '') {
      sql += ' WHERE p.proveedor_id = ?';
      params.push(Number(proveedorId));
    }
    sql += ' ORDER BY p.proveedor_id ASC, p.prioridad DESC, p.codigo ASC';

    const promociones = this.db.prepare(sql).all(...params);
    if (promociones.length === 0) {
      return [];
    }

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

    return promociones.map((promo) => ({
      ...promo,
      tramos: obtenerTramos.all(promo.id)
    }));
  }

  obtenerPorId(id) {
    const promo = this.db
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
          a.nombre AS articuloNombre,
          p.creado_en AS creadoEn
        FROM promociones p
        JOIN proveedores pr ON pr.id = p.proveedor_id
        LEFT JOIN categorias c ON c.id = p.categoria_id
        LEFT JOIN articulos a ON a.id = p.articulo_id
        WHERE p.id = ?
      `)
      .get(Number(id));

    if (!promo) return null;

    const tramos = this.db
      .prepare(`
        SELECT
          id,
          promocion_id AS promocionId,
          cantidad_minima AS cantidadMinima,
          tasa_bps AS tasaBps
        FROM promocion_tramos
        WHERE promocion_id = ?
        ORDER BY cantidad_minima ASC
      `)
      .all(promo.id);

    return {
      ...promo,
      tramos
    };
  }

  buscarPorProveedorYCodigo(proveedorId, codigo) {
    return this.db
      .prepare('SELECT id, codigo FROM promociones WHERE proveedor_id = ? AND codigo = ?')
      .get(Number(proveedorId), String(codigo));
  }

  obtenerProveedor(proveedorId) {
    return this.db.prepare('SELECT id, codigo, nombre FROM proveedores WHERE id = ?').get(Number(proveedorId));
  }

  obtenerCategoria(categoriaId) {
    return this.db.prepare('SELECT id, codigo, nombre FROM categorias WHERE id = ?').get(Number(categoriaId));
  }

  obtenerArticuloPorId(articuloId) {
    return this.db
      .prepare('SELECT id, sku, nombre, categoria_id AS categoriaId FROM articulos WHERE id = ?')
      .get(Number(articuloId));
  }

  obtenerArticuloPorSku(sku) {
    return this.db
      .prepare('SELECT id, sku, nombre, categoria_id AS categoriaId FROM articulos WHERE sku = ?')
      .get(String(sku));
  }

  crear(datos) {
    return runInTransaction(this.db, () => {
      const insertPromo = this.db.prepare(`
        INSERT INTO promociones (
          proveedor_id,
          codigo,
          nombre,
          tipo,
          tasa_bps,
          monto_fijo,
          fecha_inicio,
          fecha_fin,
          prioridad,
          monto_minimo,
          categoria_id,
          articulo_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = insertPromo.run(
        datos.proveedorId,
        datos.codigo,
        datos.nombre,
        datos.tipo,
        datos.tasaBps,
        datos.montoFijo,
        datos.fechaInicio,
        datos.fechaFin,
        datos.prioridad,
        datos.montoMinimo,
        datos.categoriaId,
        datos.articuloId
      );

      const promocionId = Number(result.lastInsertRowid);

      if (Array.isArray(datos.tramos) && datos.tramos.length > 0) {
        const insertTramo = this.db.prepare(`
          INSERT INTO promocion_tramos (promocion_id, cantidad_minima, tasa_bps)
          VALUES (?, ?, ?)
        `);
        for (const tramo of datos.tramos) {
          insertTramo.run(promocionId, tramo.cantidadMinima, tramo.tasaBps);
        }
      }

      return this.obtenerPorId(promocionId);
    });
  }
}

