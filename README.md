# ObraNeta — Sistema de Gestión de Órdenes y Motor de Promociones
**Constructora Del Valle S.A.** · Quiz #2 de Gestión de Inventarios (Parte B, Opción 3)

ObraNeta es una aplicación web empresarial diseñada para registrar órdenes de compra (OC), evaluar dinámicamente las promociones ofrecidas por proveedores y garantizar trazabilidad inmutable mediante auditoría de decisiones y reportes de ahorro.

---

## 1. Arquitectura del Proyecto

El sistema está organizado como un **monorepo con npm workspaces**:

```
ObraNeta/
├── apps/
│   ├── api/                  # Backend Node.js 24, Express, MySQL 8.4 y SQLite
│   │   ├── src/
│   │   │   ├── app.js        # Fábrica de aplicación Express (inyección de dependencias)
│   │   │   ├── server.js     # Arranque del servidor HTTP
│   │   │   ├── config/       # Variables de entorno y configuración centralizada
│   │   │   ├── db/           # Conexión, esquemas MySQL/SQLite y semillas idempotentes
│   │   │   ├── http/         # Manejo común de errores y validaciones
│   │   │   └── modules/
│   │   │       ├── catalogos/   # Consulta de proveedores, categorías y artículos
│   │   │       ├── ordenes/     # Servicios y repositorios de órdenes de compra
│   │   │       ├── promociones/ # Repositorios y Motor Puro de Promociones
│   │   │       └── reportes/    # Consultas analíticas de ahorros y vigencias
│   │   └── tests/            # Pruebas unitarias de motor e integración de API
│   └── web/                  # Frontend React 19, Vite y TypeScript
│       ├── src/
│       │   ├── app/          # App shell, barra de navegación y pie de página
│       │   ├── api/          # Cliente HTTP tipado, DTOs y manejo de errores
│       │   ├── components/   # Componentes compartidos, alertas y formateadores CRC
│       │   ├── features/
│       │   │   ├── ordenes/     # Registro de OC y vista de Auditoría histórica
│       │   │   ├── promociones/ # Lista y formulario adaptativo para los 4 tipos
│       │   │   └── reportes/    # Ahorros mensuales y promociones sin uso
│       │   └── styles/       # Estilos CSS responsivos (escritorio y móvil)
│       └── tests/            # Pruebas de componentes y flujo de interfaz (Vitest)
├── docs/                     # Diagrama ER, matriz de cobertura y guiones de entrega
├── scripts/                  # Scripts de desarrollo conjunto y verificación E2E
├── compose.yaml              # Servicio MySQL 8.4 con healthcheck y volumen persistente
├── .env.example              # Plantilla de variables de entorno
├── .gitignore
├── package.json
└── README.md
```

### Reglas de Negocio Implementadas
- **Moneda:** Todos los importes se manejan en **colones enteros costarricenses (CRC)** sin decimales.
- **Tasas Porcentuales:** Se almacenan y procesan en **puntos básicos (bps)** ($1\% = 100\text{ bps}$, $5\% = 500\text{ bps}$).
- **Redondeo:** Beneficio porcentual redondeado al colón entero más cercano con **medios colones hacia arriba (half-up)**.
- **Vigencia:** Fechas de inicio y fin inclusivas (`YYYY-MM-DD`).
- **Monto Mínimo:** Se compara contra el subtotal completo de la OC antes de cualquier descuento.
- **Filtros combinados:** Si una promoción especifica categoría y SKU, ambos deben cumplirse en la misma línea.
- **Resolución de conflictos (Gana una sola promoción):**
  1. Mayor ahorro positivo.
  2. Mayor prioridad numérica.
  3. Menor código en orden alfabético ascendente.
  4. Si ninguna genera ahorro positivo, el total neto coincide con el subtotal.
- **Auditoría inmutable:** Al confirmar una orden en su transacción atómica, se guarda un snapshot JSON de la configuración evaluada de cada promoción. Los cambios posteriores en el catálogo no alteran el histórico.

---

## 2. Requisitos Previos

- **Node.js:** Versión 24 o superior (`node -v`).
- **npm:** Versión 10 o superior (`npm -v`).
- **Docker / Docker Compose:** Opcional para levantar MySQL 8.4 en contenedor. Si no se dispone de Docker, el sistema opera de forma nativa e integrada utilizando SQLite persistente mediante `node:sqlite`.

---

## 3. Instalación y Configuración

1. **Instalar dependencias del workspace desde la raíz:**
   ```bash
   npm ci
   # o alternativamente:
   npm install
   ```

2. **Configurar el archivo de entorno:**
   ```bash
   copy .env.example .env
   ```

3. **(Opcional) Levantar MySQL 8.4 con Docker:**
   ```bash
   docker compose up -d
   ```
   *Comprobación de salud:* El contenedor `obraneta-mysql` cuenta con healthcheck automático en el puerto `3306`.

4. **Inicializar y sembrar la base de datos:**
   ```bash
   npm run db:init
   npm run db:seed
   ```
   *Nota de idempotencia:* Las semillas pueden ejecutarse repetidamente sin borrar órdenes ni duplicar registros.

---

## 4. Ejecución del Proyecto

### Modo Desarrollo (Frontend + Backend simultáneo)
```bash
npm run dev
```
- **Frontend web:** `http://localhost:5173/` (con proxy automático para `/api`).
- **Backend API:** `http://localhost:3001/`

### Comandos Individuales
```bash
# Iniciar únicamente la API
npm run dev:api

# Iniciar únicamente la aplicación Web
npm run dev:web

# Compilar ambas aplicaciones
npm run build
```

---

## 5. Pruebas Automatizadas

El proyecto incluye pruebas completas que cubren la rúbrica al 100%:

```bash
# Ejecutar todas las pruebas (API + Web)
npm test

# Ejecutar pruebas del backend (unitarias del motor + integración de API)
npm run test:api

# Ejecutar pruebas del frontend (Vitest + Testing Library)
npm run test:web

# Ejecutar verificación de extremo a extremo (E2E) del caso obligatorio
npm run test:e2e
```

---

## 6. Caso de Aceptación Obligatorio (Paso a Paso en la Demo)

Para realizar la demostración completa del Quiz desde el navegador:

1. Abra su navegador en `http://localhost:5173/`.
2. En la pestaña **1. Órdenes**, haga clic en **«Cargar ejemplo de cemento»**:
   - Se completan los campos con la orden `OC-DEMO-001` (o correlativo disponible) del `2026-10-15` para el **Proveedor A**.
   - Se carga la línea de **200 sacos de CEM-GRIS-50** a **₡6 300** cada uno.
   - Observe el subtotal preliminar calculado en tiempo real: **₡1 260 000**.
3. Presione el botón **«Registrar orden de compra»**:
   - El botón se bloquea para evitar envíos repetidos.
   - Se confirma el resultado:
     - **Subtotal:** ₡1 260 000
     - **Promoción aplicada:** `CEMENTO5`
     - **Ahorro aplicado:** ₡63 000
     - **Total neto:** ₡1 197 000
4. Haga clic en **«Abrir auditoría de la orden»** (o pestaña **2. Auditoría**):
   - **CEMENTO5:** Marcada con badge verde `APLICADA`, ahorro potencial de ₡63 000.
   - **FIJO50000:** Marcada con badge amarillo `MENOR_AHORRO` (era elegible con ahorro potencial de ₡50 000 por superar ₡1M, pero superada por CEMENTO5).
   - **CEMENTO10:** Marcada como `VENCIDA` (vigente en setiembre, orden fechada en octubre).
5. Vaya a la pestaña **4. Reportes**:
   - En **Ahorro por Proveedor**, consulte el mes `2026-10`: Muestra al Proveedor A con **₡63 000** de ahorro total acumulado.
   - En **Promociones Vigentes sin Uso**, consulte la fecha `2026-10-15`: Muestra a `FIJO50000` (vigente y no usada) y **excluye** a `CEMENTO5` (ya usada) y a `CEMENTO10` (no vigente).

---

## 7. Ejemplos de Consumo de la API en PowerShell

### 1. Registrar una Orden de Compra
```powershell
$body = @{
    numeroOc = "OC-POWERSHELL-01"
    fechaOc = "2026-10-15"
    proveedorCodigo = "PROV-A"
    lineas = @(
        @{
            sku = "CEM-GRIS-50"
            cantidad = 200
            precioUnitario = 6300
        }
    )
} | ConvertTo-Json -Depth 5

$response = Invoke-RestMethod -Uri "http://localhost:3001/api/ordenes" `
    -Method Post `
    -ContentType "application/json; charset=utf-8" `
    -Body $body

$response | Format-List numeroOc, subtotal, codigoPromocionAplicada, ahorroTotal, totalNeto
```

### 2. Consultar la Auditoría de una Orden
```powershell
$ordenId = $response.id
$auditoria = Invoke-RestMethod -Uri "http://localhost:3001/api/ordenes/$ordenId/auditoria"
$auditoria.evaluaciones | Format-Table codigo, aplicada, ahorroPotencial, motivo, explicacion -AutoSize
```

### 3. Consultar Reporte de Ahorros por Mes
```powershell
$ahorros = Invoke-RestMethod -Uri "http://localhost:3001/api/reportes/ahorros?mes=2026-10"
$ahorros.items | Format-Table proveedorNombre, mes, cantidadOrdenes, subtotalTotal, ahorroTotal, totalNeto -AutoSize
```

### 4. Consultar Promociones Vigentes sin Uso a una Fecha
```powershell
$sinUso = Invoke-RestMethod -Uri "http://localhost:3001/api/reportes/promociones-sin-uso?fecha=2026-10-15"
$sinUso.items | Format-Table codigo, proveedorNombre, tipo, fechaInicio, fechaFin -AutoSize
```

---

## 8. Documentación Adicional en `docs/`

- [`diagrama-er.md`](file:///c:/Users/calva/taller-cli/ObraNeta/docs/diagrama-er.md): Diagrama Entidad-Relación en Mermaid según el esquema implementado.
- [`cobertura-requisitos.md`](file:///c:/Users/calva/taller-cli/ObraNeta/docs/cobertura-requisitos.md): Matriz de cobertura de los requisitos del Quiz y casos de la rúbrica.
- [`guiones-entrega.md`](file:///c:/Users/calva/taller-cli/ObraNeta/docs/guiones-entrega.md): Guion de video demostrativo (5 min) y esquema de presentación (10 min).

