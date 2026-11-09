/**
 * Script de verificación E2E del Caso de Aceptación Obligatorio en el navegador/API
 * Simula el recorrido completo del usuario demo:
 * 1. Consulta catálogo (Proveedor A, cemento gris)
 * 2. Carga y registra la OC demo (200 sacos a ₡6 300)
 * 3. Valida resultado (subtotal: ₡1 260 000, promo: CEMENTO5, ahorro: ₡63 000, total: ₡1 197 000)
 * 4. Valida auditoría (CEMENTO5 aplicada, FIJO50000 menor ahorro, CEMENTO10 vencida)
 * 5. Valida reportes (ahorro de octubre = ₡63 000, sin uso incluye FIJO50000 y excluye CEMENTO5 y CEMENTO10)
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import { Duplex } from 'node:stream';
import { createApp } from '../backend/src/app.js';

console.log('🚀 Iniciando verificación de flujo E2E del caso de aceptación obligatorio...');

const { app } = createApp({ seed: true });

function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? Buffer.from(JSON.stringify(body), 'utf8') : null;
    const socket = new Duplex({ read() {}, write(_c, _e, cb) { cb(); } });
    socket.remoteAddress = '127.0.0.1';
    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    req.headers = {
      host: 'localhost',
      ...(payload
        ? {
            'content-type': 'application/json',
            'content-length': String(payload.length)
          }
        : {})
    };
    const res = new http.ServerResponse(req);
    const chunks = [];
    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);
    res.write = (c, e, cb) => { if (c) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c, e)); return origWrite(c, e, cb); };
    res.end = (c, e, cb) => {
      if (c) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c, e));
      origEnd(c, e, cb);
      const rawText = Buffer.concat(chunks).toString('utf8');
      resolve({ status: res.statusCode, data: rawText ? JSON.parse(rawText) : null });
    };
    res.on('error', reject);
    app.handle(req, res);
    process.nextTick(() => { if (payload) req.push(payload); req.push(null); });
  });
}

async function runVerification() {
  // Paso 1: Catálogos
  const cat = await request('GET', '/api/catalogos');
  assert.equal(cat.status, 200);
  const provA = cat.data.proveedores.find(p => p.nombre === 'Proveedor A');
  const artCem = cat.data.articulos.find(a => a.sku === 'CEM-GRIS-50');
  console.log('  ✔ Catálogos disponibles: Proveedor A y CEM-GRIS-50');

  // Paso 2: Registrar OC demo
  const oc = await request('POST', '/api/ordenes', {
    numeroOc: 'OC-DEMO-001',
    fechaOc: '2026-10-15',
    proveedorId: provA.id,
    lineas: [{ articuloId: artCem.id, cantidad: 200, precioUnitario: 6300 }]
  });
  assert.equal(oc.status, 201);
  console.log('  ✔ OC-DEMO-001 registrada con éxito');
  console.log(`    Subtotal: ₡${oc.data.subtotal.toLocaleString('es-CR')} (Esperado: ₡1 260 000)`);
  console.log(`    Promoción: ${oc.data.codigoAplicado} (Esperado: CEMENTO5)`);
  console.log(`    Ahorro: ₡${oc.data.ahorro.toLocaleString('es-CR')} (Esperado: ₡63 000)`);
  console.log(`    Total neto: ₡${oc.data.totalNeto.toLocaleString('es-CR')} (Esperado: ₡1 197 000)`);

  assert.equal(oc.data.subtotal, 1260000);
  assert.equal(oc.data.codigoAplicado, 'CEMENTO5');
  assert.equal(oc.data.ahorro, 63000);
  assert.equal(oc.data.totalNeto, 1197000);

  // Paso 3: Auditoría y descartes
  const aud = await request('GET', `/api/ordenes/${oc.data.id}/auditoria`);
  assert.equal(aud.status, 200);
  const evCemento5 = aud.data.evaluaciones.find(e => e.codigo === 'CEMENTO5');
  const evFijo50000 = aud.data.evaluaciones.find(e => e.codigo === 'FIJO50000');
  const evCemento10 = aud.data.evaluaciones.find(e => e.codigo === 'CEMENTO10');

  assert.equal(evCemento5.aplicada, true);
  assert.equal(evCemento5.motivo, 'APLICADA');
  assert.equal(evFijo50000.motivo, 'MENOR_AHORRO');
  assert.equal(evCemento10.motivo, 'VENCIDA');
  console.log('  ✔ Auditoría verificada: CEMENTO5 aplicada, FIJO50000 descartada por MENOR_AHORRO, CEMENTO10 descartada por VENCIDA');

  // Paso 4: Reportes
  const repAhorro = await request('GET', '/api/reportes/ahorros?mes=2026-10');
  const provAAhorro = repAhorro.data.items.find(i => i.proveedorNombre === 'Proveedor A');
  assert.equal(provAAhorro.ahorroTotal, 63000);
  console.log('  ✔ Reporte de ahorros octubre 2026: ₡63 000 para Proveedor A');

  const repSinUso = await request('GET', '/api/reportes/promociones-sin-uso?fecha=2026-10-15');
  const codigos = repSinUso.data.items.map(p => p.codigo);
  assert.ok(codigos.includes('FIJO50000'), 'Debe incluir FIJO50000');
  assert.ok(!codigos.includes('CEMENTO5'), 'Debe excluir CEMENTO5');
  assert.ok(!codigos.includes('CEMENTO10'), 'Debe excluir CEMENTO10');
  console.log('  ✔ Reporte promociones sin uso al 2026-10-15: incluye FIJO50000 y excluye CEMENTO5 y CEMENTO10');

  console.log('\n🎉 ¡TODAS LAS COMPROBACIONES DEL CASO DE ACEPTACIÓN PASARON SATISFACTORIAMENTE!\n');
}

runVerification().catch(err => {
  console.error('Error en verificación E2E:', err);
  process.exit(1);
});
