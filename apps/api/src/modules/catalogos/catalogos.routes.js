import { Router } from 'express';

export class CatalogosRepository {
  constructor(db) {
    this.db = db;
  }

  listarProveedores() {
    return this.db.prepare('SELECT id, codigo, nombre FROM proveedores ORDER BY id ASC').all();
  }

  listarCategorias() {
    return this.db.prepare('SELECT id, codigo, nombre FROM categorias ORDER BY id ASC').all();
  }

  listarArticulos() {
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
        ORDER BY a.id ASC
      `)
      .all();
  }
}

export function createCatalogosRouter(catalogosRepo) {
  const router = Router();

  router.get('/', (_req, res, next) => {
    try {
      res.json({
        proveedores: catalogosRepo.listarProveedores(),
        categorias: catalogosRepo.listarCategorias(),
        articulos: catalogosRepo.listarArticulos()
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/proveedores', (_req, res, next) => {
    try {
      res.json({ items: catalogosRepo.listarProveedores() });
    } catch (error) {
      next(error);
    }
  });

  router.get('/categorias', (_req, res, next) => {
    try {
      res.json({ items: catalogosRepo.listarCategorias() });
    } catch (error) {
      next(error);
    }
  });

  router.get('/articulos', (_req, res, next) => {
    try {
      res.json({ items: catalogosRepo.listarArticulos() });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
