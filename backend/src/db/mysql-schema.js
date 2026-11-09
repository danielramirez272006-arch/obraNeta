/**
 * Migraciones DDL para MySQL 8.4 (InnoDB, utf8mb4).
 */
export const MYSQL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS proveedores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(32) NOT NULL UNIQUE,
  nombre VARCHAR(120) NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(32) NOT NULL UNIQUE,
  nombre VARCHAR(120) NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS articulos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(32) NOT NULL UNIQUE,
  nombre VARCHAR(150) NOT NULL,
  categoria_id INT NOT NULL,
  unidad VARCHAR(20) NOT NULL DEFAULT 'unidad',
  precio_sugerido BIGINT NOT NULL DEFAULT 0,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_articulos_categoria FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promociones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  proveedor_id INT NOT NULL,
  codigo VARCHAR(32) NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  tipo ENUM('PORCENTAJE', 'MONTO_FIJO', 'ESCALONADO', 'DOS_POR_UNO') NOT NULL,
  tasa_bps INT NULL,
  monto_fijo BIGINT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  prioridad INT NOT NULL DEFAULT 1,
  monto_minimo BIGINT NOT NULL DEFAULT 0,
  categoria_id INT NULL,
  articulo_id INT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_promo_proveedor_codigo (proveedor_id, codigo),
  INDEX idx_promociones_proveedor (proveedor_id),
  CONSTRAINT fk_promociones_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE RESTRICT,
  CONSTRAINT fk_promociones_categoria FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT,
  CONSTRAINT fk_promociones_articulo FOREIGN KEY (articulo_id) REFERENCES articulos(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promocion_tramos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  promocion_id INT NOT NULL,
  cantidad_minima INT NOT NULL,
  tasa_bps INT NOT NULL,
  UNIQUE KEY uq_tramo_promo_cant (promocion_id, cantidad_minima),
  CONSTRAINT fk_tramos_promocion FOREIGN KEY (promocion_id) REFERENCES promociones(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ordenes_compra (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero_oc VARCHAR(64) NOT NULL UNIQUE,
  proveedor_id INT NOT NULL,
  fecha_oc DATE NOT NULL,
  subtotal BIGINT NOT NULL,
  promocion_aplicada_id INT NULL,
  codigo_promocion_aplicada VARCHAR(32) NULL,
  ahorro_total BIGINT NOT NULL DEFAULT 0,
  total_neto BIGINT NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ordenes_proveedor_fecha (proveedor_id, fecha_oc),
  CONSTRAINT fk_ordenes_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ordenes_promo_aplicada FOREIGN KEY (promocion_aplicada_id) REFERENCES promociones(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orden_compra_lineas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orden_id INT NOT NULL,
  articulo_id INT NOT NULL,
  cantidad INT NOT NULL,
  precio_unitario BIGINT NOT NULL,
  subtotal_linea BIGINT NOT NULL,
  CONSTRAINT fk_lineas_orden FOREIGN KEY (orden_id) REFERENCES ordenes_compra(id) ON DELETE CASCADE,
  CONSTRAINT fk_lineas_articulo FOREIGN KEY (articulo_id) REFERENCES articulos(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orden_compra_auditoria (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orden_id INT NOT NULL,
  promocion_id INT NULL,
  codigo_promocion VARCHAR(32) NOT NULL,
  nombre_promocion VARCHAR(150) NOT NULL,
  tipo_promocion VARCHAR(32) NOT NULL,
  configuracion_json JSON NOT NULL,
  elegible TINYINT(1) NOT NULL DEFAULT 0,
  aplicada TINYINT(1) NOT NULL DEFAULT 0,
  ahorro_potencial BIGINT NOT NULL DEFAULT 0,
  motivo VARCHAR(32) NOT NULL,
  explicacion TEXT NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_auditoria_orden (orden_id),
  CONSTRAINT fk_auditoria_orden FOREIGN KEY (orden_id) REFERENCES ordenes_compra(id) ON DELETE CASCADE,
  CONSTRAINT fk_auditoria_promo FOREIGN KEY (promocion_id) REFERENCES promociones(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

