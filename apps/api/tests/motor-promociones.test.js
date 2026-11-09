import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MOTIVOS_EVALUACION,
  TIPOS_PROMOCION,
  calcularDescuentoPorcentual,
  evaluarPromocionesOrden
} from '../src/modules/promociones/motor-promociones.js';

describe('Motor de promociones (lógica de negocio pura)', () => {
  it('Rúbrica 1: Descarta promoción vencida con motivo VENCIDA y futura con AUN_NO_VIGENTE', () => {
    const orden = {
      fecha: '2026-10-15',
      lineas: [
        { sku: 'CEM-GRIS-50', categoriaCodigo: 'CEMENTO', cantidad: 100, precioUnitario: 6300 }
      ]
    };

    const promociones = [
      {
        id: 1,
        codigo: 'CEMENTO10',
        nombre: 'Promo vencida septiembre',
        tipo: TIPOS_PROMOCION.PORCENTAJE,
        tasaBps: 1000,
        fechaInicio: '2026-09-01',
        fechaFin: '2026-09-30',
        prioridad: 10,
        sku: 'CEM-GRIS-50'
      },
      {
        id: 2,
        codigo: 'CEMENTO_NOV',
        nombre: 'Promo futura noviembre',
        tipo: TIPOS_PROMOCION.PORCENTAJE,
        tasaBps: 800,
        fechaInicio: '2026-11-01',
        fechaFin: '2026-11-30',
        prioridad: 10,
        sku: 'CEM-GRIS-50'
      }
    ];

    const resultado = evaluarPromocionesOrden(orden, promociones);
    assert.equal(resultado.subtotal, 630000);
    assert.equal(resultado.ahorro, 0);
    assert.equal(resultado.totalNeto, 630000);
    assert.equal(resultado.promocionAplicada, null);

    const evalVencida = resultado.evaluaciones.find((e) => e.codigo === 'CEMENTO10');
    assert.equal(evalVencida.elegible, false);
    assert.equal(evalVencida.ahorroPotencial, 0);
    assert.equal(evalVencida.motivo, MOTIVOS_EVALUACION.VENCIDA);

    const evalFutura = resultado.evaluaciones.find((e) => e.codigo === 'CEMENTO_NOV');
    assert.equal(evalFutura.elegible, false);
    assert.equal(evalFutura.ahorroPotencial, 0);
    assert.equal(evalFutura.motivo, MOTIVOS_EVALUACION.AUN_NO_VIGENTE);
  });

  it('Rúbrica 2: Descarta promoción cuando el subtotal de la OC está bajo el mínimo (MONTO_INSUFICIENTE)', () => {
    const orden = {
      fecha: '2026-10-15',
      lineas: [
        { sku: 'CEM-GRIS-50', categoriaCodigo: 'CEMENTO', cantidad: 100, precioUnitario: 6300 }
      ]
    };

    const promociones = [
      {
        id: 1,
        codigo: 'FIJO50000',
        nombre: 'Bono fijo compras >= 1M',
        tipo: TIPOS_PROMOCION.MONTO_FIJO,
        montoFijo: 50000,
        montoMinimo: 1000000,
        fechaInicio: '2026-10-01',
        fechaFin: '2026-10-31',
        prioridad: 5
      }
    ];

    const resultado = evaluarPromocionesOrden(orden, promociones);
    assert.equal(resultado.subtotal, 630000);
    assert.equal(resultado.ahorro, 0);
    assert.equal(resultado.totalNeto, 630000);
    assert.equal(resultado.evaluaciones[0].motivo, MOTIVOS_EVALUACION.MONTO_INSUFICIENTE);
  });

  it('Rúbrica 3: Dos promociones en conflicto aplican la de mayor ahorro y marcan MENOR_AHORRO en la otra', () => {
    const orden = {
      fecha: '2026-10-15',
      lineas: [
        { sku: 'CEM-GRIS-50', categoriaCodigo: 'CEMENTO', cantidad: 200, precioUnitario: 6300 }
      ]
    };

    const promociones = [
      {
        id: 1,
        codigo: 'CEMENTO5',
        nombre: '5% en cemento',
        tipo: TIPOS_PROMOCION.PORCENTAJE,
        tasaBps: 500,
        fechaInicio: '2026-10-01',
        fechaFin: '2026-10-31',
        prioridad: 10,
        sku: 'CEM-GRIS-50'
      },
      {
        id: 2,
        codigo: 'FIJO50000',
        nombre: '50 mil fijo sobre 1M',
        tipo: TIPOS_PROMOCION.MONTO_FIJO,
        montoFijo: 50000,
        montoMinimo: 1000000,
        fechaInicio: '2026-10-01',
        fechaFin: '2026-10-31',
        prioridad: 5
      }
    ];

    const resultado = evaluarPromocionesOrden(orden, promociones);
    assert.equal(resultado.subtotal, 1260000);
    assert.equal(resultado.codigoPromocionAplicada, 'CEMENTO5');
    assert.equal(resultado.ahorro, 63000);
    assert.equal(resultado.totalNeto, 1197000);

    const ganadora = resultado.evaluaciones.find((e) => e.codigo === 'CEMENTO5');
    const descartada = resultado.evaluaciones.find((e) => e.codigo === 'FIJO50000');

    assert.equal(ganadora.aplicada, true);
    assert.equal(ganadora.motivo, MOTIVOS_EVALUACION.APLICADA);
    assert.equal(descartada.elegible, true);
    assert.equal(descartada.aplicada, false);
    assert.equal(descartada.ahorroPotencial, 50000);
    assert.equal(descartada.motivo, MOTIVOS_EVALUACION.MENOR_AHORRO);
  });

  it('Rúbrica 4: Categoría no aplicable o filtro combinado categoría+SKU en distinta línea devuelve SIN_LINEAS_ELEGIBLES', () => {
    const orden = {
      fecha: '2026-10-15',
      lineas: [
        { sku: 'CEM-GRIS-50', categoriaCodigo: 'CEMENTO', cantidad: 50, precioUnitario: 6300 }
      ]
    };

    const promociones = [
      {
        id: 1,
        codigo: 'ACERO10',
        nombre: '10% en categoría acero',
        tipo: TIPOS_PROMOCION.PORCENTAJE,
        tasaBps: 1000,
        categoriaCodigo: 'ACERO',
        fechaInicio: '2026-10-01',
        fechaFin: '2026-10-31'
      },
      {
        id: 2,
        codigo: 'FILTRO_CRUZADO',
        nombre: 'Requiere categoría ACERO y SKU CEM-GRIS-50 en la misma línea',
        tipo: TIPOS_PROMOCION.PORCENTAJE,
        tasaBps: 1000,
        categoriaCodigo: 'ACERO',
        sku: 'CEM-GRIS-50',
        fechaInicio: '2026-10-01',
        fechaFin: '2026-10-31'
      }
    ];

    const resultado = evaluarPromocionesOrden(orden, promociones);
    assert.equal(resultado.ahorro, 0);
    assert.equal(resultado.evaluaciones[0].motivo, MOTIVOS_EVALUACION.SIN_LINEAS_ELEGIBLES);
    assert.equal(resultado.evaluaciones[1].motivo, MOTIVOS_EVALUACION.SIN_LINEAS_ELEGIBLES);
  });

  it('Rúbrica 5: Promoción válida única se aplica y calcula subtotal, ahorro y total neto exactos', () => {
    const orden = {
      fecha: '2026-10-15',
      lineas: [
        { sku: 'CEM-GRIS-50', categoriaCodigo: 'CEMENTO', cantidad: 10, precioUnitario: 6300 }
      ]
    };

    const promociones = [
      {
        id: 1,
        codigo: 'CEMENTO5',
        nombre: '5% en cemento',
        tipo: TIPOS_PROMOCION.PORCENTAJE,
        tasaBps: 500,
        sku: 'CEM-GRIS-50',
        fechaInicio: '2026-10-01',
        fechaFin: '2026-10-31'
      }
    ];

    const resultado = evaluarPromocionesOrden(orden, promociones);
    assert.equal(resultado.subtotal, 63000);
    assert.equal(resultado.ahorro, 3150);
    assert.equal(resultado.totalNeto, 59850);
    assert.equal(resultado.evaluaciones[0].motivo, MOTIVOS_EVALUACION.APLICADA);
  });

  it('Evalúa límites inclusivos de vigencia (primer y último día del rango son válidos)', () => {
    const promo = {
      id: 1,
      codigo: 'OCTUBRE',
      tipo: TIPOS_PROMOCION.MONTO_FIJO,
      montoFijo: 5000,
      fechaInicio: '2026-10-01',
      fechaFin: '2026-10-31'
    };

    const resInicio = evaluarPromocionesOrden(
      { fecha: '2026-10-01', lineas: [{ sku: 'A', cantidad: 2, precioUnitario: 10000 }] },
      [promo]
    );
    assert.equal(resInicio.ahorro, 5000);
    assert.equal(resInicio.evaluaciones[0].motivo, MOTIVOS_EVALUACION.APLICADA);

    const resFin = evaluarPromocionesOrden(
      { fecha: '2026-10-31', lineas: [{ sku: 'A', cantidad: 2, precioUnitario: 10000 }] },
      [promo]
    );
    assert.equal(resFin.ahorro, 5000);
    assert.equal(resFin.evaluaciones[0].motivo, MOTIVOS_EVALUACION.APLICADA);
  });

  it('Evalúa 2×1 (DOS_POR_UNO) con cantidad impar y precios distintos tomando las unidades más baratas gratis', () => {
    // 5 unidades del mismo SKU en dos líneas a precios distintos:
    // - 2 unidades a ₡500
    // - 3 unidades a ₡800
    // Total unidades = 5 -> floor(5 / 2) = 2 unidades gratis.
    // Deben tomarse las 2 unidades de menor precio (2 * ₡500 = ₡1 000).
    const orden = {
      fecha: '2026-11-10',
      lineas: [
        { sku: 'BLOQ-EST-15', cantidad: 3, precioUnitario: 800 },
        { sku: 'BLOQ-EST-15', cantidad: 2, precioUnitario: 500 }
      ]
    };

    const promociones = [
      {
        id: 1,
        codigo: '2X1-BLOQUES',
        tipo: TIPOS_PROMOCION.DOS_POR_UNO,
        sku: 'BLOQ-EST-15',
        fechaInicio: '2026-11-01',
        fechaFin: '2026-11-30'
      }
    ];

    const resultado = evaluarPromocionesOrden(orden, promociones);
    assert.equal(resultado.subtotal, 3400);
    assert.equal(resultado.ahorro, 1000);
    assert.equal(resultado.totalNeto, 2400);
  });

  it('Evalúa ESCALONADO con cantidad exacta de un tramo y descarta cuando no alcanza el primer tramo', () => {
    const promoEscalonada = {
      id: 1,
      codigo: 'ESCALA-VARILLA',
      tipo: TIPOS_PROMOCION.ESCALONADO,
      sku: 'VAR-CORR-38',
      fechaInicio: '2026-11-01',
      fechaFin: '2026-12-31',
      tramos: [
        { cantidadMinima: 50, tasaBps: 400 },
        { cantidadMinima: 100, tasaBps: 800 },
        { cantidadMinima: 200, tasaBps: 1200 }
      ]
    };

    // Exactamente 100 unidades -> alcanza el segundo tramo (8% = 800 bps)
    const resExacto = evaluarPromocionesOrden(
      {
        fecha: '2026-11-15',
        lineas: [{ sku: 'VAR-CORR-38', cantidad: 100, precioUnitario: 4000 }]
      },
      [promoEscalonada]
    );
    assert.equal(resExacto.subtotal, 400000);
    assert.equal(resExacto.ahorro, 32000);
    assert.equal(resExacto.evaluaciones[0].motivo, MOTIVOS_EVALUACION.APLICADA);

    // 49 unidades -> no alcanza el tramo mínimo de 50 -> TRAMO_NO_ALCANZADO
    const resInsuficiente = evaluarPromocionesOrden(
      {
        fecha: '2026-11-15',
        lineas: [{ sku: 'VAR-CORR-38', cantidad: 49, precioUnitario: 4000 }]
      },
      [promoEscalonada]
    );
    assert.equal(resInsuficiente.ahorro, 0);
    assert.equal(resInsuficiente.evaluaciones[0].motivo, MOTIVOS_EVALUACION.TRAMO_NO_ALCANZADO);
  });

  it('Resuelve desempates por prioridad y luego por orden alfabético del código con motivo DESEMPATE', () => {
    const orden = {
      fecha: '2026-10-15',
      lineas: [{ sku: 'CEM-GRIS-50', cantidad: 10, precioUnitario: 10000 }]
    };

    // Empate de ahorro (10 000 cada una): gana PRIO_ALTA por prioridad 20 vs 10
    const resPrioridad = evaluarPromocionesOrden(orden, [
      {
        id: 1,
        codigo: 'PRIO_BAJA',
        tipo: TIPOS_PROMOCION.MONTO_FIJO,
        montoFijo: 10000,
        prioridad: 10,
        fechaInicio: '2026-10-01',
        fechaFin: '2026-10-31'
      },
      {
        id: 2,
        codigo: 'PRIO_ALTA',
        tipo: TIPOS_PROMOCION.PORCENTAJE,
        tasaBps: 1000,
        prioridad: 20,
        fechaInicio: '2026-10-01',
        fechaFin: '2026-10-31'
      }
    ]);
    assert.equal(resPrioridad.codigoPromocionAplicada, 'PRIO_ALTA');
    const perdedoraPrio = resPrioridad.evaluaciones.find((e) => e.codigo === 'PRIO_BAJA');
    assert.equal(perdedoraPrio.motivo, MOTIVOS_EVALUACION.DESEMPATE);

    // Empate de ahorro y misma prioridad (15): gana ALFA_A sobre BETA_B por orden alfabético
    const resAlfabetico = evaluarPromocionesOrden(orden, [
      {
        id: 1,
        codigo: 'BETA_B',
        tipo: TIPOS_PROMOCION.MONTO_FIJO,
        montoFijo: 10000,
        prioridad: 15,
        fechaInicio: '2026-10-01',
        fechaFin: '2026-10-31'
      },
      {
        id: 2,
        codigo: 'ALFA_A',
        tipo: TIPOS_PROMOCION.MONTO_FIJO,
        montoFijo: 10000,
        prioridad: 15,
        fechaInicio: '2026-10-01',
        fechaFin: '2026-10-31'
      }
    ]);
    assert.equal(resAlfabetico.codigoPromocionAplicada, 'ALFA_A');
    const perdedoraAlfa = resAlfabetico.evaluaciones.find((e) => e.codigo === 'BETA_B');
    assert.equal(perdedoraAlfa.motivo, MOTIVOS_EVALUACION.DESEMPATE);
  });

  it('Redondea el beneficio porcentual al colón más cercano con medios colones hacia arriba', () => {
    // 100 colones * 250 bps (2.5%) = 2.5 colones -> redondea hacia arriba a 3 colones
    assert.equal(calcularDescuentoPorcentual(100, 250), 3);
    // 100 colones * 249 bps (2.49%) = 2.49 colones -> redondea a 2 colones
    assert.equal(calcularDescuentoPorcentual(100, 249), 2);
  });
});

