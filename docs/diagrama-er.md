# Diagrama Entidad-Relación — ObraNeta
**Constructora Del Valle S.A.** · Gestión de Inventarios (Quiz #2, Parte B, Opción 3)

Este diagrama representa el modelo relacional implementado en MySQL 8.4 (InnoDB, utf8mb4) y SQLite, con integridad referencial, claves foráneas estrictas y tipos de datos normalizados.

```mermaid
erDiagram
    PROVEEDORES ||--o{ ARTICULOS : "ofrece"
    PROVEEDORES ||--o{ PROMOCIONES : "define"
    PROVEEDORES ||--o{ ORDENES_COMPRA : "recibe"
    CATEGORIAS ||--o{ ARTICULOS : "clasifica"
    CATEGORIAS ||--o{ PROMOCIONES : "filtro opcional"
    ARTICULOS ||--o{ PROMOCIONES : "filtro opcional o requerido"
    ARTICULOS ||--o{ ORDEN_COMPRA_LINEAS : "se incluye en"
    PROMOCIONES ||--o{ PROMOCION_TRAMOS : "posee tramos"
    PROMOCIONES ||--o{ ORDENES_COMPRA : "aplica como ganadora"
    ORDENES_COMPRA ||--|{ ORDEN_COMPRA_LINEAS : "contiene"
    ORDENES_COMPRA ||--|{ ORDEN_COMPRA_AUDITORIA : "registra evaluacion"

    PROVEEDORES {
        int id PK
        string codigo UK "PROV-A, PROV-B"
        string nombre
        timestamp creado_en
    }

    CATEGORIAS {
        int id PK
        string codigo UK "CEMENTO, ACERO, MAMPOSTERIA"
        string nombre
        timestamp creado_en
    }

    ARTICULOS {
        int id PK
        string sku UK "CEM-GRIS-50, etc."
        string nombre
        int categoria_id FK
        string unidad "saco, varilla, unidad"
        bigint precio_sugerido "CRC enteros"
        timestamp creado_en
    }

    PROMOCIONES {
        int id PK
        int proveedor_id FK
        string codigo "UK compuesta con proveedor_id"
        string nombre
        enum tipo "PORCENTAJE, MONTO_FIJO, ESCALONADO, DOS_POR_UNO"
        int tasa_bps "Puntos básicos (100 = 1%)"
        bigint monto_fijo "CRC enteros"
        date fecha_inicio "YYYY-MM-DD inclusiva"
        date fecha_fin "YYYY-MM-DD inclusiva"
        int prioridad "Desempate primario"
        bigint monto_minimo "CRC enteros sobre subtotal OC"
        int categoria_id FK "Filtro opcional"
        int articulo_id FK "Filtro opcional / obligatorio para 3 y 4"
        timestamp creado_en
    }

    PROMOCION_TRAMOS {
        int id PK
        int promocion_id FK
        int cantidad_minima "UK compuesta con promocion_id"
        int tasa_bps "Tasa en puntos básicos"
    }

    ORDENES_COMPRA {
        int id PK
        string numero_oc UK "OC-DEMO-001, etc."
        int proveedor_id FK
        date fecha_oc "YYYY-MM-DD"
        bigint subtotal "CRC enteros"
        int promocion_aplicada_id FK
        string codigo_promocion_aplicada
        bigint ahorro_total "CRC enteros"
        bigint total_neto "subtotal - ahorro_total"
        timestamp creado_en
    }

    ORDEN_COMPRA_LINEAS {
        int id PK
        int orden_id FK
        int articulo_id FK
        int cantidad "Entero positivo > 0"
        bigint precio_unitario "CRC enteros >= 0"
        bigint subtotal_linea "cantidad * precio_unitario"
    }

    ORDEN_COMPRA_AUDITORIA {
        int id PK
        int orden_id FK
        int promocion_id FK
        string codigo_promocion
        string nombre_promocion
        string tipo_promocion
        json configuracion_json "Snapshot inmutable"
        tinyint elegible "1: Si, 0: No"
        tinyint aplicada "1: Ganadora, 0: Descartada"
        bigint ahorro_potencial "CRC enteros"
        string motivo "APLICADA, VENCIDA, MENOR_AHORRO, etc."
        text explicacion "Lenguaje natural claro"
        timestamp creado_en
    }
```
