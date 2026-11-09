# Guiones de Entrega — ObraNeta

## 1. Guion de Video de Demostración (Máximo 5 Minutos)

**Audiencia:** Profesor y evaluadores del curso Gestión de Inventarios.  
**Objetivo:** Demostrar el flujo funcional completo, el motor de promociones y la persistencia en base de datos.

---

### Minuto 0:00 - 0:45 | Introducción y Arquitectura
- **Pantalla:** Navegador abierto en `http://localhost:5173/` y terminal dividida mostrando la API y la estructura del monorepo.
- **Narración:**
  > "Buenas tardes. Presentamos ObraNeta, la solución de optimización de compras y motor de promociones para Constructora Del Valle S.A., desarrollada bajo una arquitectura de monorepo con Node.js 24, Express, MySQL 8.4, React 19 y TypeScript.
  > Todas las operaciones monetarias se calculan en colones enteros costarricenses (CRC) y los descuentos porcentuales se manejan en puntos básicos con redondeo al colón más cercano."

---

### Minuto 0:45 - 2:00 | Caso de Aceptación Obligatorio (OC de Cemento)
- **Pantalla:** Navegar a la pestaña **1. Órdenes**.
- **Acción:**
  1. Hacer clic en el botón **«Cargar ejemplo de cemento»**.
  2. Mostrar cómo se completan los campos: Número `OC-DEMO-001`, fecha `2026-10-15`, Proveedor A, y línea de 200 sacos de `CEM-GRIS-50` a ₡6 300.
  3. Señalar el subtotal preliminar calculado en tiempo real: `₡1 260 000`.
  4. Presionar **«Registrar orden de compra»**.
- **Narración:**
  > "Utilizamos el botón rápido 'Cargar ejemplo de cemento'. El subtotal preliminar es de ₡1 260 000. Al presionar guardar, el botón se deshabilita para evitar peticiones duplicadas y el backend ejecuta la transacción atómica completa.
  > El resultado confirmado por el motor nos indica: Subtotal ₡1 260 000, Promoción ganadora CEMENTO5 con un ahorro exacto de ₡63 000 (el 5%) y un total neto confirmado de ₡1 197 000."

---

### Minuto 2:00 - 3:00 | Auditoría Inmutable de la Orden
- **Pantalla:** Hacer clic en **«Abrir auditoría de la orden»** (Pestaña **2. Auditoría**).
- **Acción:**
  1. Recorrer las 3 tarjetas de promociones evaluadas.
  2. Resaltar la tarjeta verde: `CEMENTO5` (Aplicada, ahorro ₡63 000).
  3. Resaltar la tarjeta de descarte 1: `FIJO50000` (Elegible, ahorro potencial ₡50 000, motivo `MENOR_AHORRO`).
  4. Resaltar la tarjeta de descarte 2: `CEMENTO10` (No elegible, ahorro ₡0, motivo `VENCIDA`).
- **Narración:**
  > "La pantalla de auditoría muestra la trazabilidad inmutable de todas las promociones que competían.
  > Observamos que CEMENTO5 ganó legítimamente; FIJO50000 era elegible por superar el millón de colones pero ofreció ₡50 000 frente a ₡63 000, por lo que se descartó por MENOR_AHORRO. Finalmente, CEMENTO10 venció el 30 de setiembre y la orden tiene fecha 15 de octubre, marcándose correctamente como VENCIDA."

---

### Minuto 3:00 - 4:00 | Creación de Promociones y los 4 Tipos
- **Pantalla:** Navegar a la pestaña **3. Promociones**.
- **Acción:**
  1. Cambiar el selector de tipo entre `PORCENTAJE`, `MONTO_FIJO`, `ESCALONADO` y `DOS_POR_UNO`.
  2. Mostrar cómo los campos y validaciones se adaptan dinámicamente.
  3. Mostrar en la tabla inferior las promociones sembradas de los otros tipos (`ESCALA-VARILLA` y `2X1-BLOQUES` del Proveedor B).
- **Narración:**
  > "En la sección de promociones podemos registrar los cuatro tipos solicitados en la rúbrica. Los campos se adaptan al tipo seleccionado, requiriendo SKU para tramos o 2×1 y validando rangos de fechas reales.
  > La carga de semillas es idempotente y no duplica filas ni borra órdenes existentes."

---

### Minuto 4:00 - 4:45 | Reportes de Inteligencia de Compras
- **Pantalla:** Navegar a la pestaña **4. Reportes**.
- **Acción:**
  1. En **Ahorro por Proveedor**, consultar el mes `2026-10`. Mostrar al Proveedor A con ₡63 000 de ahorro y ₡1 197 000 netos.
  2. En **Promociones sin Uso**, consultar la fecha `2026-10-15`. Mostrar que aparece `FIJO50000` y están excluidas `CEMENTO5` (ya usada) y `CEMENTO10` (vencida).
- **Narración:**
  > "El reporte mensual de octubre totaliza ₡63 000 de ahorro obtenido con el Proveedor A.
  > Y en el reporte de promociones sin uso al 15 de octubre, el sistema incluye correctamente FIJO50000 (vigente pero no aplicada) y excluye CEMENTO5 por haber sido utilizada, y CEMENTO10 por no tener vigencia ese día."

---

### Minuto 4:45 - 5:00 | Pruebas y Cierre
- **Pantalla:** Terminal ejecutando `npm test`.
- **Narración:**
  > "Finalmente, ejecutamos npm test en la raíz: 16 pruebas unitarias, de integración y de rúbrica pasan en verde. ObraNeta queda lista para producción. Muchas gracias."

---

## 2. Esquema para Presentación Oral (10 Minutos)

- **Diapositiva 1 (1 min) | Portada y Contexto del Negocio:**
  - Constructora Del Valle S.A.
  - Problemática: Descuentos dispersos de proveedores, órdenes sin optimización de costos y falta de auditoría histórica.
- **Diapositiva 2 (1.5 min) | Arquitectura Tecnológica:**
  - Monorepo npm workspaces (`apps/api` y `apps/web`).
  - Backend: Node.js 24, Express, MySQL 8.4 (InnoDB, utf8mb4), SQLite (modo portátil).
  - Frontend: React 19, TypeScript, Vite con proxy de desarrollo.
  - Integridad: Aritmética entera en CRC, puntos básicos (bps) y redondeo half-up.
- **Diapositiva 3 (2 min) | Modelo de Datos y Esquema Relacional:**
  - Entidades: Proveedores, Categorías, Artículos, Órdenes, Líneas, Promociones, Tramos y Auditoría.
  - Claves foráneas ON DELETE RESTRICT / CASCADE.
  - Snapshot JSON inmutable en auditoría para desacoplar el historial de cambios futuros en catálogos.
- **Diapositiva 4 (2 min) | El Motor de Promociones (Lógica Pura):**
  - Desacoplado de frameworks y bases de datos.
  - Los 4 tipos: Porcentaje, Monto Fijo, Escalonado por volumen de SKU y 2×1 con priorización de unidades más baratas.
  - Algoritmo de resolución de conflictos: Mayor ahorro > Mayor prioridad > Orden alfabético.
- **Diapositiva 5 (2.5 min) | Demostración en Vivo del Caso de Aceptación:**
  - Registro de la OC de cemento (`OC-DEMO-001`).
  - Inspección de los 2 descartes en auditoría (`MENOR_AHORRO` y `VENCIDA`).
  - Verificación de los dos reportes de gestión.
- **Diapositiva 6 (1 min) | Conclusiones y Suite de Pruebas:**
  - 100% de cobertura de los casos de la rúbrica y casos borde.
  - Idempotencia de semillas y reversión atómica de transacciones.
