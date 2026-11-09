/**
 * Esquema relacional de ObraNeta en SQLite.
 * Todos los importes monetarios se almacenan en colones enteros (CRC).
 * Las tasas porcentuales se almacenan en puntos básicos (1% = 100 bps, 5% = 500 bps).
 */
export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS proveedores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS articulos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  categoria_id INTEGER NOT NULL,
  unidad TEXT NOT NULL DEFAULT 'unidad',
  precio_sugerido INTEGER NOT NULL DEFAULT 0 CHECK (precio_sugerido >= 0),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS promociones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proveedor_id INTEGER NOT NULL,
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('PORCENTAJE', 'MONTO_FIJO', 'ESCALONADO', 'DOS_POR_UNO')),
  tasa_bps INTEGER NULL CHECK (tasa_bps IS NULL OR (tasa_bps > 0 AND tasa_bps <= 10000)),
  monto_fijo INTEGER NULL CHECK (monto_fijo IS NULL OR monto_fijo > 0),
  fecha_inicio TEXT NOT NULL,
  fecha_fin TEXT NOT NULL,
  prioridad INTEGER NOT NULL DEFAULT 1,
  monto_minimo INTEGER NOT NULL DEFAULT 0 CHECK (monto_minimo >= 0),
  categoria_id INTEGER NULL,
  articulo_id INTEGER NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (proveedor_id, codigo),
  FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE RESTRICT,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT,
  FOREIGN KEY (articulo_id) REFERENCES articulos(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS promocion_tramos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  promocion_id INTEGER NOT NULL,
  cantidad_minima INTEGER NOT NULL CHECK (cantidad_minima > 0),
  tasa_bps INTEGER NOT NULL CHECK (tasa_bps > 0 AND tasa_bps <= 10000),
  UNIQUE (promocion_id, cantidad_minima),
  FOREIGN KEY (promocion_id) REFERENCES promociones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ordenes_compra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero_oc TEXT NOT NULL UNIQUE,
  proveedor_id INTEGER NOT NULL,
  fecha_oc TEXT NOT NULL,
  subtotal INTEGER NOT NULL CHECK (subtotal >= 0),
  promocion_aplicada_id INTEGER NULL,
  codigo_promocion_aplicada TEXT NULL,
  ahorro_total INTEGER NOT NULL DEFAULT 0 CHECK (ahorro_total >= 0),
  total_neto INTEGER NOT NULL CHECK (total_neto >= 0),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE RESTRICT,
  FOREIGN KEY (promocion_aplicada_id) REFERENCES promociones(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS orden_compra_lineas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orden_id INTEGER NOT NULL,
  articulo_id INTEGER NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario INTEGER NOT NULL CHECK (precio_unitario >= 0),
  subtotal_linea INTEGER NOT NULL CHECK (subtotal_linea >= 0),
  FOREIGN KEY (orden_id) REFERENCES ordenes_compra(id) ON DELETE CASCADE,
  FOREIGN KEY (articulo_id) REFERENCES articulos(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS orden_compra_auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orden_id INTEGER NOT NULL,
  promocion_id INTEGER NULL,
  codigo_promocion TEXT NOT NULL,
  nombre_promocion TEXT NOT NULL,
  tipo_promocion TEXT NOT NULL,
  configuracion_json TEXT NOT NULL,
  elegible INTEGER NOT NULL DEFAULT 0 CHECK (elegible IN (0, 1)),
  aplicada INTEGER NOT NULL DEFAULT 0 CHECK (aplicada IN (0, 1)),
  ahorro_potencial INTEGER NOT NULL DEFAULT 0 CHECK (ahorro_potencial >= 0),
  motivo TEXT NOT NULL,
  explicacion TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (orden_id) REFERENCES ordenes_compra(id) ON DELETE CASCADE,
  FOREIGN KEY (promocion_id) REFERENCES promociones(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_promociones_proveedor ON promociones(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_proveedor_fecha ON ordenes_compra(proveedor_id, fecha_oc);
CREATE INDEX IF NOT EXISTS idx_auditoria_orden ON orden_compra_auditoria(orden_id);
`;

export function applySchema(db) {
  db.exec(SCHEMA_SQL);
}

