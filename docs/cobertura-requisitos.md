# Matriz de Cobertura de Requisitos — ObraNeta

Esta tabla detalla cómo cada requerimiento de la rúbrica y especificación técnica se encuentra implementado en el backend, en el frontend y validado mediante pruebas automatizadas.

| Requisito / Caso de Rúbrica | Implementación en Código | Pruebas Automatizadas | Verificación Frontend |
| :--- | :--- | :--- | :--- |
| **Arquitectura Monorepo** (Node 24, Express, MySQL 8.4, React, Vite, TS) | `package.json` (workspaces), `apps/api/src/app.js`, `apps/web/src/app/App.tsx` | `npm run build`, `npm test` | Proxy `/api` configurado en `apps/web/vite.config.ts` |
| **Rúbrica 1: Promoción Vencida y Futura** | `motor-promociones.js` (validación de fechas inclusivas con `YYYY-MM-DD`) | `apps/api/tests/motor-promociones.test.js` (Caso Rúbrica 1) | Motivo `VENCIDA` y `AUN_NO_VIGENTE` visible en Auditoría |
| **Rúbrica 2: Monto bajo el mínimo** | `motor-promociones.js` (compara `montoMinimo` contra el subtotal completo antes de descuento) | `apps/api/tests/motor-promociones.test.js` (Caso Rúbrica 2) | Motivo `MONTO_INSUFICIENTE` en Auditoría |
| **Rúbrica 3: Conflicto entre promociones** | `motor-promociones.js` (aplica la de mayor beneficio y descarta la menor) | `apps/api/tests/motor-promociones.test.js` (Caso Rúbrica 3) | Ganadora con badge `APLICADA`, perdedora con badge y motivo `MENOR_AHORRO` |
| **Rúbrica 4: Categoría no aplicable / Filtro cruzado** | `motor-promociones.js` (categoría y SKU deben cumplirse en la misma línea) | `apps/api/tests/motor-promociones.test.js` (Caso Rúbrica 4) | Motivo `SIN_LINEAS_ELEGIBLES` |
| **Rúbrica 5: Promoción válida única** | `motor-promociones.js` (cálculo de subtotal, beneficio exacto en CRC y total neto) | `apps/api/tests/motor-promociones.test.js` (Caso Rúbrica 5) | Confirmación inmediata de subtotal, ahorro y neto |
| **Límites inclusivos de vigencia** | `motor-promociones.js` (`fechaOc >= fechaInicio && fechaOc <= fechaFin`) | `apps/api/tests/motor-promociones.test.js` | Funciona en primer y último día del rango |
| **2×1 con cantidad impar y precios distintos** | `motor-promociones.js` (toma unidades de menor precio como gratuitas) | `apps/api/tests/motor-promociones.test.js` | Válido en compras mixtas del mismo SKU |
| **Escalonado por tramos exactos** | `motor-promociones.js` (umbral mayor alcanzado por cantidad acumulada) | `apps/api/tests/motor-promociones.test.js` | `TRAMO_NO_ALCANZADO` si no supera el primer escalón |
| **Desempates determinísticos** | `motor-promociones.js` (ahorro > prioridad > orden alfabético de código) | `apps/api/tests/motor-promociones.test.js` | Motivo `DESEMPATE` con explicación clara |
| **Transacción Atómica y Reversión** | `ordenes.repository.js` (`BEGIN IMMEDIATE TRANSACTION` / `conn.beginTransaction()`) | `apps/api/tests/api-integracion.test.js` | Sin registros huérfanos ante fallo provocado |
| **Control de Concurrencia / Duplicados** | `ordenes.service.js` (devuelve HTTP 409 Conflict) | `apps/api/tests/api-integracion.test.js` | Error visual `fieldErrors.numeroOc` en pantalla de Órdenes |
| **Caso de Aceptación Obligatorio (OC Cemento)** | 200 sacos CEM-GRIS-50 a ₡6 300: Subtotal ₡1 260 000, CEMENTO5 ₡63 000, Neto ₡1 197 000 | `apps/api/tests/api-integracion.test.js`, `scripts/e2e-verify.mjs` | Botón «Cargar ejemplo de cemento» en vista Órdenes |
| **Auditoría Histórica Inmutable** | `orden_compra_auditoria` con snapshot JSON independiente | `apps/api/tests/api-integracion.test.js` | Vista Auditoría preserva snapshot tras mutación de promo |
| **Reporte de Ahorros por Proveedor y Mes** | `GET /api/reportes/ahorros?mes=YYYY-MM` | `apps/api/tests/api-integracion.test.js` | Pantalla Reportes con filtro mensual e importe consolidado |
| **Reporte Promociones sin Uso a una Fecha** | `GET /api/reportes/promociones-sin-uso?fecha=YYYY-MM-DD` | `apps/api/tests/api-integracion.test.js` | Muestra FIJO50000 y excluye CEMENTO5 y CEMENTO10 |
| **Semillas Idempotentes** | `seedDatabase()` y `seedMysql()` con `ON CONFLICT / ON DUPLICATE KEY` | `apps/api/tests/api-integracion.test.js` | Ejecutable indefinidamente sin duplicados ni borrado |
| **Aislamiento Base Test vs Dev** | `apps/api/src/config/env.js` | `apps/api/tests/mysql-integracion.test.js` | Impide ejecución si `database === testDatabase` |

