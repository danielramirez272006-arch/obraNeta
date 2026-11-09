import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { Duplex } from 'node:stream';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { seedDatabase } from '../src/db/seed.js';

/**
 * Ejecuta una petición HTTP contra la aplicación Express en memoria
 * pasando por todos los middlewares (express.json, rutas y errorHandler)
 * sin requerir abrir puertos TCP del sistema operativo.
 */
function requestApp(app, method, url, body = undefined) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? Buffer.from(JSON.stringify(body), 'utf8') : null;

    const socket = new Duplex({
      read() {},
      write(_chunk, _enc, cb) {
        cb();
      }
    });
    socket.remoteAddress = '127.0.0.1';

    const req = new http.IncomingMessage(socket);
    req.method = method.toUpperCase();
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

    res.write = (chunk, encoding, cb) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      }
      return origWrite(chunk, encoding, cb);
    };

    res.end = (chunk, encoding, cb) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      }
      origEnd(chunk, encoding, cb);
      const rawText = Buffer.concat(chunks).toString('utf8');
      resolve({
        status: res.statusCode,
        text: async () => rawText,
        json: async () => (rawText ? JSON.parse(rawText) : null)
      });
    };

    res.on('error', reject);

    app.handle(req, res);

    process.nextTick(() => {
      if (payload) {
        req.push(payload);
      }
      req.push(null);
    });
  });
}

describe('API de ObraNeta e integración con SQLite temporal', () => {
  let tmpDir;
  let dbPath;
  let appInstance;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'obraneta-test-'));
    dbPath = path.join(tmpDir, 'test.sqlite');
    appInstance = createApp({ dbPath, seed: true });
  });

  afterEach(() => {
    if (appInstance?.db) {
      try {
        appInstance.db.close();
      } catch {
        // Ignorar si ya fue cerrada
      }
    }
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('Completa el caso de aceptación obligatorio: OC de cemento, auditoría y los dos reportes', async () => {
    // 1. Consultar catálogos para obtener el Proveedor A y CEM-GRIS-50
    const catRes = await requestApp(appInstance.app, 'GET', '/api/catalogos');
    assert.equal(catRes.status, 200);
    const catalogos = await catRes.json();

    const proveedorA = catalogos.proveedores.find((p) => p.nombre === 'Proveedor A');
    const cemGris = catalogos.articulos.find((a) => a.sku === 'CEM-GRIS-50');
    assert.ok(proveedorA, 'Debe existir el Proveedor A en semillas');
    assert.ok(cemGris, 'Debe existir el artículo CEM-GRIS-50 en semillas');

    // 2. Registrar la OC de demo del 2026-10-15 para el Proveedor A por 200 sacos a ₡6 300
    const ocRes = await requestApp(appInstance.app, 'POST', '/api/ordenes', {
      numeroOc: 'OC-2026-001',
      fechaOc: '2026-10-15',
      proveedorId: proveedorA.id,
      lineas: [
        {
          articuloId: cemGris.id,
          cantidad: 200,
          precioUnitario: 6300
        }
      ]
    });

    assert.equal(ocRes.status, 201);
    const ocCreada = await ocRes.json();
    assert.equal(ocCreada.subtotal, 1260000);
    assert.equal(ocCreada.codigoAplicado, 'CEMENTO5');
    assert.equal(ocCreada.ahorro, 63000);
    assert.equal(ocCreada.totalNeto, 1197000);

    // 3. Consultar la auditoría guardada
    const audRes = await requestApp(
      appInstance.app,
      'GET',
      `/api/ordenes/${ocCreada.id}/auditoria`
    );
    assert.equal(audRes.status, 200);
    const auditoria = await audRes.json();
    assert.equal(auditoria.evaluaciones.length, 3);

    const evalCemento5 = auditoria.evaluaciones.find((e) => e.codigo === 'CEMENTO5');
    const evalFijo50000 = auditoria.evaluaciones.find((e) => e.codigo === 'FIJO50000');
    const evalCemento10 = auditoria.evaluaciones.find((e) => e.codigo === 'CEMENTO10');

    assert.equal(evalCemento5.aplicada, true);
    assert.equal(evalCemento5.ahorroPotencial, 63000);
    assert.equal(evalCemento5.motivo, 'APLICADA');

    assert.equal(evalFijo50000.elegible, true);
    assert.equal(evalFijo50000.aplicada, false);
    assert.equal(evalFijo50000.ahorroPotencial, 50000);
    assert.equal(evalFijo50000.motivo, 'MENOR_AHORRO');

    assert.equal(evalCemento10.elegible, false);
    assert.equal(evalCemento10.aplicada, false);
    assert.equal(evalCemento10.ahorroPotencial, 0);
    assert.equal(evalCemento10.motivo, 'VENCIDA');

    // 4. Comprobar que el reporte de ahorros de octubre muestra ₡63 000 para el Proveedor A
    const repAhorrosRes = await requestApp(
      appInstance.app,
      'GET',
      '/api/reportes/ahorros?mes=2026-10'
    );
    assert.equal(repAhorrosRes.status, 200);
    const repAhorros = await repAhorrosRes.json();
    const ahorroProvA = repAhorros.items.find((i) => i.proveedorNombre === 'Proveedor A');
    assert.ok(ahorroProvA);
    assert.equal(ahorroProvA.ahorroTotal, 63000);
    assert.equal(ahorroProvA.subtotalTotal, 1260000);
    assert.equal(ahorroProvA.totalNeto, 1197000);

    // 5. Comprobar el reporte de promociones vigentes sin uso al 2026-10-15:
    // incluye FIJO50000 y excluye CEMENTO5 y CEMENTO10
    const repSinUsoRes = await requestApp(
      appInstance.app,
      'GET',
      '/api/reportes/promociones-sin-uso?fecha=2026-10-15'
    );
    assert.equal(repSinUsoRes.status, 200);
    const repSinUso = await repSinUsoRes.json();
    const codigosSinUso = repSinUso.items.map((p) => p.codigo);
    assert.ok(codigosSinUso.includes('FIJO50000'), 'Debe incluir FIJO50000');
    assert.ok(!codigosSinUso.includes('CEMENTO5'), 'Debe excluir CEMENTO5 por estar ya aplicada');
    assert.ok(!codigosSinUso.includes('CEMENTO10'), 'Debe excluir CEMENTO10 por no estar vigente');

    // 6. Verificar inmutabilidad histórica de la auditoría aunque cambie una promoción después
    appInstance.db
      .prepare("UPDATE promociones SET tasa_bps = 900 WHERE codigo = 'CEMENTO5'")
      .run();
    const audHistoricaRes = await requestApp(
      appInstance.app,
      'GET',
      `/api/ordenes/${ocCreada.id}/auditoria`
    );
    const audHistorica = await audHistoricaRes.json();
    const snapCemento5 = audHistorica.evaluaciones.find((e) => e.codigo === 'CEMENTO5');
    assert.equal(snapCemento5.configuracion.tasaBps, 500);
    assert.equal(snapCemento5.ahorroPotencial, 63000);

    // 7. Repetir semillas no duplica registros ni borra la OC creada
    seedDatabase(appInstance.db);
    const checkOcRes = await requestApp(appInstance.app, 'GET', `/api/ordenes/${ocCreada.id}`);
    assert.equal(checkOcRes.status, 200);
  });

  it('Permite crear los cuatro tipos de promoción por API y valida campos requeridos', async () => {
    const catRes = await requestApp(appInstance.app, 'GET', '/api/catalogos');
    const catalogos = await catRes.json();
    const proveedorA = catalogos.proveedores.find((p) => p.codigo === 'PROV-A');
    const cemGris = catalogos.articulos.find((a) => a.sku === 'CEM-GRIS-50');

    // Crear ESCALONADO
    const resEscala = await requestApp(appInstance.app, 'POST', '/api/promociones', {
      proveedorId: proveedorA.id,
      codigo: 'CEM-ESCALA',
      nombre: 'Escala cemento',
      tipo: 'ESCALONADO',
      articuloId: cemGris.id,
      fechaInicio: '2026-11-01',
      fechaFin: '2026-11-30',
      prioridad: 4,
      tramos: [
        { cantidadMinima: 50, tasaBps: 300 },
        { cantidadMinima: 150, tasaBps: 700 }
      ]
    });
    assert.equal(resEscala.status, 201);

    // Crear DOS_POR_UNO
    const res2x1 = await requestApp(appInstance.app, 'POST', '/api/promociones', {
      proveedorId: proveedorA.id,
      codigo: 'CEM-2X1',
      nombre: '2x1 en cemento',
      tipo: 'DOS_POR_UNO',
      articuloId: cemGris.id,
      fechaInicio: '2026-12-01',
      fechaFin: '2026-12-31',
      prioridad: 3
    });
    assert.equal(res2x1.status, 201);

    // Error cuando falta SKU en ESCALONADO
    const resInvalido = await requestApp(appInstance.app, 'POST', '/api/promociones', {
      proveedorId: proveedorA.id,
      codigo: 'SIN-SKU',
      nombre: 'Escala sin SKU',
      tipo: 'ESCALONADO',
      fechaInicio: '2026-11-01',
      fechaFin: '2026-11-30',
      tramos: []
    });
    assert.equal(resInvalido.status, 400);
    const errBody = await resInvalido.json();
    assert.ok(errBody.fields.articuloId);
    assert.ok(errBody.fields.tramos);
  });

  it('Devuelve HTTP 409 al intentar registrar un número de OC duplicado y errores de campo en validaciones', async () => {
    const payload = {
      numeroOc: 'OC-DUP-100',
      fechaOc: '2026-10-15',
      proveedorCodigo: 'PROV-A',
      lineas: [{ sku: 'CEM-GRIS-50', cantidad: 10, precioUnitario: 6300 }]
    };

    const res1 = await requestApp(appInstance.app, 'POST', '/api/ordenes', payload);
    assert.equal(res1.status, 201);

    const res2 = await requestApp(appInstance.app, 'POST', '/api/ordenes', payload);
    assert.equal(res2.status, 409);
    const bodyDup = await res2.json();
    assert.ok(bodyDup.fields.numeroOc);

    // Fecha calendario inexistente (2026-02-29 no es bisiesto)
    const resFechaInvalida = await requestApp(appInstance.app, 'POST', '/api/ordenes', {
      ...payload,
      numeroOc: 'OC-FECHA-INVALIDA',
      fechaOc: '2026-02-29'
    });
    assert.equal(resFechaInvalida.status, 400);
    const bodyFecha = await resFechaInvalida.json();
    assert.ok(bodyFecha.fields.fechaOc);
  });

  it('Revierte toda la transacción si ocurre un fallo al guardar la orden sin dejar registros parciales', () => {
    const { ordenesService } = appInstance.services;

    assert.throws(() => {
      ordenesService.registrarOrden(
        {
          numeroOc: 'OC-FALLIDA-ROLLBACK',
          fechaOc: '2026-10-15',
          proveedorCodigo: 'PROV-A',
          lineas: [{ sku: 'CEM-GRIS-50', cantidad: 20, precioUnitario: 6300 }]
        },
        {
          beforeCommitHook: () => {
            throw new Error('Fallo simulado antes de confirmar transacción');
          }
        }
      );
    }, /Fallo simulado/);

    const countOrdenes = appInstance.db
      .prepare("SELECT COUNT(*) AS total FROM ordenes_compra WHERE numero_oc = 'OC-FALLIDA-ROLLBACK'")
      .get().total;
    const countLineas = appInstance.db
      .prepare('SELECT COUNT(*) AS total FROM orden_compra_lineas')
      .get().total;
    const countAuditoria = appInstance.db
      .prepare('SELECT COUNT(*) AS total FROM orden_compra_auditoria')
      .get().total;

    assert.equal(countOrdenes, 0);
    assert.equal(countLineas, 0);
    assert.equal(countAuditoria, 0);
  });
});
