import { runInTransaction } from '../../db/connection.js';

export class OrdenesRepository {
  /**
   * @param {import('node:sqlite').DatabaseSync} db
   */
  constructor(db) {
    this.db = db;
  }

  listar() {
    return this.db
      .prepare(`
        SELECT
          o.id,
          o.numero_oc AS numeroOc,
          o.proveedor_id AS proveedorId,
          p.codigo AS proveedorCodigo,
          p.nombre AS proveedorNombre,
          o.fecha_oc AS fechaOc,
          o.subtotal,
          o.promocion_aplicada_id AS promocionAplicadaId,
          o.codigo_promocion_aplicada AS codigoAplicado,
          o.codigo_promocion_aplicada AS codigoPromocionAplicada,
          o.ahorro_total AS ahorro,
          o.ahorro_total AS ahorroTotal,
          o.total_neto AS totalNeto,
          o.creado_en AS creadoEn,
          (SELECT COUNT(*) FROM orden_compra_lineas l WHERE l.orden_id = o.id) AS cantidadLineas
        FROM ordenes_compra o
        JOIN proveedores p ON p.id = o.proveedor_id
        ORDER BY o.id DESC
      `)
      .all();
  }

  buscarPorNumeroOc(numeroOc) {
    return this.db
      .prepare('SELECT id, numero_oc AS numeroOc FROM ordenes_compra WHERE numero_oc = ?')
      .get(String(numeroOc));
  }

  obtenerProveedor(proveedorId) {
    return this.db
      .prepare('SELECT id, codigo, nombre FROM proveedores WHERE id = ?')
      .get(Number(proveedorId));
  }

  obtenerProveedorPorCodigo(codigo) {
    return this.db
      .prepare('SELECT id, codigo, nombre FROM proveedores WHERE codigo = ?')
      .get(String(codigo));
  }

  obtenerArticuloPorId(articuloId) {
    return this.db
      .prepare(`
        SELECT
          a.id,
          a.sku,
          a.nombre,
          a.unidad,
          a.precio_sugerido AS precioSugerido,
          a.categoria_id AS categoriaId,
          c.codigo AS categoriaCodigo,
          c.nombre AS categoriaNombre
        FROM articulos a
        JOIN categorias c ON c.id = a.categoria_id
        WHERE a.id = ?
      `)
      .get(Number(articuloId));
  }

  obtenerArticuloPorSku(sku) {
    return this.db
      .prepare(`
        SELECT
          a.id,
          a.sku,
          a.nombre,
          a.unidad,
          a.precio_sugerido AS precioSugerido,
          a.categoria_id AS categoriaId,
          c.codigo AS categoriaCodigo,
          c.nombre AS categoriaNombre
        FROM articulos a
        JOIN categorias c ON c.id = a.categoria_id
        WHERE a.sku = ?
      `)
      .get(String(sku));
  }

  obtenerPorId(id) {
    const orden = this.db
      .prepare(`
        SELECT
          o.id,
          o.numero_oc AS numeroOc,
          o.proveedor_id AS proveedorId,
          p.codigo AS proveedorCodigo,
          p.nombre AS proveedorNombre,
          o.fecha_oc AS fechaOc,
          o.subtotal,
          o.promocion_aplicada_id AS promocionAplicadaId,
          o.codigo_promocion_aplicada AS codigoAplicado,
          o.codigo_promocion_aplicada AS codigoPromocionAplicada,
          o.ahorro_total AS ahorro,
          o.ahorro_total AS ahorroTotal,
          o.total_neto AS totalNeto,
          o.creado_en AS creadoEn
        FROM ordenes_compra o
        JOIN proveedores p ON p.id = o.proveedor_id
        WHERE o.id = ?
      `)
      .get(Number(id));

    if (!orden) return null;

    const lineas = this.db
      .prepare(`
        SELECT
          l.id,
          l.orden_id AS ordenId,
          l.articulo_id AS articuloId,
          a.sku,
          a.nombre AS articuloNombre,
          a.unidad,
          a.categoria_id AS categoriaId,
          c.codigo AS categoriaCodigo,
          c.nombre AS categoriaNombre,
          l.cantidad,
          l.precio_unitario AS precioUnitario,
          l.subtotal_linea AS subtotalLinea
        FROM orden_compra_lineas l
        JOIN articulos a ON a.id = l.articulo_id
        JOIN categorias c ON c.id = a.categoria_id
        WHERE l.orden_id = ?
        ORDER BY l.id ASC
      `)
      .all(orden.id);

    return {
      ...orden,
      lineas
    };
  }

  obtenerAuditoriaPorOrdenId(ordenId) {
    const orden = this.obtenerPorId(ordenId);
    if (!orden) return null;

    const filas = this.db
      .prepare(`
        SELECT
          id,
          orden_id AS ordenId,
          promocion_id AS promocionId,
          codigo_promocion AS codigo,
          nombre_promocion AS nombre,
          tipo_promocion AS tipo,
          configuracion_json AS configuracionJson,
          elegible,
          aplicada,
          ahorro_potencial AS ahorroPotencial,
          motivo,
          explicacion,
          creado_en AS creadoEn
        FROM orden_compra_auditoria
        WHERE orden_id = ?
        ORDER BY aplicada DESC, ahorro_potencial DESC, codigo_promocion ASC
      `)
      .all(Number(ordenId));

    const evaluaciones = filas.map((f) => ({
      id: f.id,
      ordenId: f.ordenId,
      promocionId: f.promocionId,
      codigo: f.codigo,
      nombre: f.nombre,
      tipo: f.tipo,
      elegible: Boolean(f.elegible),
      aplicada: Boolean(f.aplicada),
      ahorroPotencial: f.ahorroPotencial,
      motivo: f.motivo,
      explicacion: f.explicacion,
      configuracion: JSON.parse(f.configuracionJson),
      creadoEn: f.creadoEn
    }));

    return {
      ordenId: orden.id,
      numeroOc: orden.numeroOc,
      fechaOc: orden.fechaOc,
      proveedorId: orden.proveedorId,
      proveedorNombre: orden.proveedorNombre,
      subtotal: orden.subtotal,
      codigoAplicado: orden.codigoAplicado,
      ahorro: orden.ahorro,
      totalNeto: orden.totalNeto,
      evaluaciones
    };
  }

  /**
   * Guarda en una sola transacción atómica la OC, sus líneas, el descuento y toda la auditoría.
   */
  guardarOrdenCompleta({
    numeroOc,
    proveedorId,
    fechaOc,
    subtotal,
    promocionAplicadaId,
    codigoPromocionAplicada,
    ahorroTotal,
    totalNeto,
    lineas,
    evaluaciones,
    beforeCommitHook
  }) {
    return runInTransaction(this.db, () => {
      const insertOrden = this.db.prepare(`
        INSERT INTO ordenes_compra (
          numero_oc,
          proveedor_id,
          fecha_oc,
          subtotal,
          promocion_aplicada_id,
          codigo_promocion_aplicada,
          ahorro_total,
          total_neto
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const resOrden = insertOrden.run(
        numeroOc,
        proveedorId,
        fechaOc,
        subtotal,
        promocionAplicadaId ?? null,
        codigoPromocionAplicada ?? null,
        ahorroTotal,
        totalNeto
      );

      const ordenId = Number(resOrden.lastInsertRowid);

      const insertLinea = this.db.prepare(`
        INSERT INTO orden_compra_lineas (
          orden_id,
          articulo_id,
          cantidad,
          precio_unitario,
          subtotal_linea
        ) VALUES (?, ?, ?, ?, ?)
      `);

      for (const linea of lineas) {
        insertLinea.run(
          ordenId,
          linea.articuloId,
          linea.cantidad,
          linea.precioUnitario,
          linea.subtotalLinea
        );
      }

      const insertAuditoria = this.db.prepare(`
        INSERT INTO orden_compra_auditoria (
          orden_id,
          promocion_id,
          codigo_promocion,
          nombre_promocion,
          tipo_promocion,
          configuracion_json,
          elegible,
          aplicada,
          ahorro_potencial,
          motivo,
          explicacion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const ev of evaluaciones) {
        insertAuditoria.run(
          ordenId,
          ev.promocionId ?? null,
          ev.codigo,
          ev.nombre,
          ev.tipo,
          JSON.stringify(ev.configuracion),
          ev.elegible ? 1 : 0,
          ev.aplicada ? 1 : 0,
          ev.ahorroPotencial,
          ev.motivo,
          ev.explicacion
        );
      }

      if (typeof beforeCommitHook === 'function') {
        beforeCommitHook(ordenId);
      }

      return this.obtenerPorId(ordenId);
    });
  }
}

