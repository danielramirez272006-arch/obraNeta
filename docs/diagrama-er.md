# Diagrama Entidad-Relación — ObraNeta
**Constructora Del Valle S.A.** · Gestión de Inventarios (Quiz #2, Parte B, Opción 3)

Este diagrama representa el modelo relacional exacto implementado en las migraciones de MySQL 8.4 (InnoDB, utf8mb4) y SQLite, con integridad referencial, claves foráneas estrictas y tipos de datos normalizados.

```mermaid
erDiagram
    PROVEEDORES ||--o{ PROMOCIONES : "define (proveedor_id)"
    PROVEEDORES ||--o{ ORDENES_COMPRA : "recibe (proveedor_id)"
    CATEGORIAS ||--o{ ARTICULOS : "clasifica (categoria_id)"
    CATEGORIAS ||--o{ PROMOCIONES : "filtro opcional (categoria_id)"
    ARTICULOS ||--o{ PROMOCIONES : "filtro opcional/requerido (articulo_id)"
    ARTICULOS ||--o{ ORDEN_COMPRA_LINEAS : "se incluye en (articulo_id)"
    PROMOCIONES ||--o{ PROMOCION_TRAMOS : "posee tramos (promocion_id)"
    PROMOCIONES |o--o{ ORDENES_COMPRA : "aplica como ganadora (promocion_aplicada_id)"
    PROMOCIONES |o--o{ ORDEN_COMPRA_AUDITORIA : "referencia historica (promocion_id)"
    ORDENES_COMPRA ||--|{ ORDEN_COMPRA_LINEAS : "contiene (orden_id)"
    ORDENES_COMPRA ||--|{ ORDEN_COMPRA_AUDITORIA : "registra evaluacion (orden_id)"

    PROVEEDORES {
        int id PK "INT AUTO_INCREMENT"
        string codigo UK "VARCHAR(32) UNIQUE"
        string nombre "VARCHAR(120)"
        timestamp creado_en "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    }

    CATEGORIAS {
        int id PK "INT AUTO_INCREMENT"
        string codigo UK "VARCHAR(32) UNIQUE"
        string nombre "VARCHAR(120)"
        timestamp creado_en "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    }

    ARTICULOS {
        int id PK "INT AUTO_INCREMENT"
        string sku UK "VARCHAR(32) UNIQUE"
        string nombre "VARCHAR(150)"
        int categoria_id FK "INT REFERENCES categorias(id)"
        string unidad "VARCHAR(20) DEFAULT 'unidad'"
        bigint precio_sugerido "BIGINT DEFAULT 0 (CRC enteros)"
        timestamp creado_en "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    }

    PROMOCIONES {
        int id PK "INT AUTO_INCREMENT"
        int proveedor_id FK "INT REFERENCES proveedores(id)"
        string codigo "VARCHAR(32) UNIQUE KEY con proveedor_id"
        string nombre "VARCHAR(150)"
        enum tipo "ENUM('PORCENTAJE','MONTO_FIJO','ESCALONADO','DOS_POR_UNO')"
        int tasa_bps "INT NULL (Puntos básicos, 100 bps = 1%)"
        bigint monto_fijo "BIGINT NULL (CRC enteros)"
        date fecha_inicio "DATE (YYYY-MM-DD inclusiva)"
        date fecha_fin "DATE (YYYY-MM-DD inclusiva)"
        int prioridad "INT DEFAULT 1"
        bigint monto_minimo "BIGINT DEFAULT 0 (CRC enteros sobre subtotal OC)"
        int categoria_id FK "INT NULL REFERENCES categorias(id)"
        int articulo_id FK "INT NULL REFERENCES articulos(id)"
        timestamp creado_en "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    }

    PROMOCION_TRAMOS {
        int id PK "INT AUTO_INCREMENT"
        int promocion_id FK "INT REFERENCES promociones(id) ON DELETE CASCADE"
        int cantidad_minima "INT UNIQUE KEY con promocion_id"
        int tasa_bps "INT (Puntos básicos, 100 bps = 1%)"
    }

    ORDENES_COMPRA {
        int id PK "INT AUTO_INCREMENT"
        string numero_oc UK "VARCHAR(64) UNIQUE"
        int proveedor_id FK "INT REFERENCES proveedores(id)"
        date fecha_oc "DATE (YYYY-MM-DD)"
        bigint subtotal "BIGINT (CRC enteros)"
        int promocion_aplicada_id FK "INT NULL REFERENCES promociones(id) ON DELETE SET NULL"
        string codigo_promocion_aplicada "VARCHAR(32) NULL"
        bigint ahorro_total "BIGINT DEFAULT 0 (CRC enteros)"
        bigint total_neto "BIGINT (subtotal - ahorro_total)"
        timestamp creado_en "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    }

    ORDEN_COMPRA_LINEAS {
        int id PK "INT AUTO_INCREMENT"
        int orden_id FK "INT REFERENCES ordenes_compra(id) ON DELETE CASCADE"
        int articulo_id FK "INT REFERENCES articulos(id) ON DELETE RESTRICT"
        int cantidad "INT (Entero positivo > 0)"
        bigint precio_unitario "BIGINT (CRC enteros >= 0)"
        bigint subtotal_linea "BIGINT (cantidad * precio_unitario)"
    }

    ORDEN_COMPRA_AUDITORIA {
        int id PK "INT AUTO_INCREMENT"
        int orden_id FK "INT REFERENCES ordenes_compra(id) ON DELETE CASCADE"
        int promocion_id FK "INT NULL REFERENCES promociones(id) ON DELETE SET NULL"
        string codigo_promocion "VARCHAR(32)"
        string nombre_promocion "VARCHAR(150)"
        string tipo_promocion "VARCHAR(32)"
        json configuracion_json "JSON (Snapshot inmutable de la configuracion)"
        tinyint elegible "TINYINT(1) DEFAULT 0"
        tinyint aplicada "TINYINT(1) DEFAULT 0"
        bigint ahorro_potencial "BIGINT DEFAULT 0 (CRC enteros)"
        string motivo "VARCHAR(32) (APLICADA, MENOR_AHORRO, VENCIDA, etc.)"
        text explicacion "TEXT"
        timestamp creado_en "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    }
```
