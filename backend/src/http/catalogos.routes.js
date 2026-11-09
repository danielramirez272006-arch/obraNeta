import { Router } from 'express';

/**
 * Rutas de consulta de catálogos (proveedores, categorías y artículos) para poblar formularios del frontend.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function createCatalogosRouter(db) {
  const router = Router();

  const listarProveedores = () =>
    db
      .prepare('SELECT id, codigo, nombre FROM proveedores ORDER BY id ASC')
      .all();

  const listarCategorias = () =>
    db
      .prepare('SELECT id, codigo, nombre FROM categorias ORDER BY id ASC')
      .all();

  const listarArticulos = () =>
    db
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
        ORDER BY a.id ASC
      `)
      .all();

  router.get('/', (_req, res, next) => {
    try {
      res.json({
        proveedores: listarProveedores(),
        categorias: listarCategorias(),
        articulos: listarArticulos()
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/proveedores', (_req, res, next) => {
    try {
      res.json({ items: listarProveedores() });
    } catch (error) {
      next(error);
    }
  });

  router.get('/categorias', (_req, res, next) => {
    try {
      res.json({ items: listarCategorias() });
    } catch (error) {
      next(error);
    }
  });

  router.get('/articulos', (_req, res, next) => {
    try {
      res.json({ items: listarArticulos() });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

