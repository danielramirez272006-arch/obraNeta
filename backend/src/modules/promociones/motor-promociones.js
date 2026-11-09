/**
 * Motor de promociones de ObraNeta (lógica de negocio pura, sin dependencias de Express ni SQLite).
 *
 * Reglas:
 * - Todos los importes monetarios son colones enteros (CRC).
 * - Las tasas porcentuales se expresan en puntos básicos (1% = 100 bps, 100% = 10000 bps).
 * - El redondeo porcentual es al colón más cercano con medios colones hacia arriba (half-up).
 * - Fechas de inicio y fin son inclusivas (YYYY-MM-DD).
 * - El monto mínimo se evalúa sobre el subtotal completo de la OC antes de descuento.
 * - Si hay filtros de categoría y SKU, ambos deben cumplirse en la misma línea.
 * - Gana el mayor ahorro positivo; empate -> mayor prioridad; empate -> código alfabético menor.
 */

export const MOTIVOS_EVALUACION = Object.freeze({
  APLICADA: 'APLICADA',
  VENCIDA: 'VENCIDA',
  AUN_NO_VIGENTE: 'AUN_NO_VIGENTE',
  MONTO_INSUFICIENTE: 'MONTO_INSUFICIENTE',
  SIN_LINEAS_ELEGIBLES: 'SIN_LINEAS_ELEGIBLES',
  TRAMO_NO_ALCANZADO: 'TRAMO_NO_ALCANZADO',
  SIN_AHORRO: 'SIN_AHORRO',
  MENOR_AHORRO: 'MENOR_AHORRO',
  DESEMPATE: 'DESEMPATE'
});

export const TIPOS_PROMOCION = Object.freeze({
  PORCENTAJE: 'PORCENTAJE',
  MONTO_FIJO: 'MONTO_FIJO',
  ESCALONADO: 'ESCALONADO',
  DOS_POR_UNO: 'DOS_POR_UNO'
});

/**
 * Calcula el descuento porcentual en colones enteros a partir de puntos básicos (bps),
 * redondeando al colón más cercano con medios colones hacia arriba (0.5 -> 1).
 * @param {number} montoElegible
 * @param {number} tasaBps
 * @returns {number}
 */
export function calcularDescuentoPorcentual(montoElegible, tasaBps) {
  if (montoElegible <= 0 || tasaBps <= 0) {
    return 0;
  }
  return Math.floor((montoElegible * tasaBps + 5000) / 10000);
}

function normalizarLinea(linea) {
  const cantidad = Number(linea.cantidad);
  const precioUnitario = Number(linea.precioUnitario ?? linea.precio_unitario);
  return {
    articuloId: linea.articuloId ?? linea.articulo_id ?? null,
    sku: linea.sku ?? null,
    categoriaId: linea.categoriaId ?? linea.categoria_id ?? null,
    categoriaCodigo: linea.categoriaCodigo ?? linea.categoria_codigo ?? null,
    cantidad,
    precioUnitario,
    subtotalLinea: cantidad * precioUnitario
  };
}

function normalizarPromocion(promo) {
  const tramosRaw = Array.isArray(promo.tramos) ? promo.tramos : [];
  const tramos = tramosRaw
    .map((t) => ({
      cantidadMinima: Number(t.cantidadMinima ?? t.cantidad_minima),
      tasaBps: Number(t.tasaBps ?? t.tasa_bps)
    }))
    .sort((a, b) => a.cantidadMinima - b.cantidadMinima);

  return {
    id: promo.id ?? null,
    proveedorId: promo.proveedorId ?? promo.proveedor_id ?? null,
    codigo: String(promo.codigo),
    nombre: String(promo.nombre ?? promo.codigo),
    tipo: String(promo.tipo),
    tasaBps:
      promo.tasaBps !== undefined && promo.tasaBps !== null
        ? Number(promo.tasaBps)
        : promo.tasa_bps !== undefined && promo.tasa_bps !== null
          ? Number(promo.tasa_bps)
          : null,
    montoFijo:
      promo.montoFijo !== undefined && promo.montoFijo !== null
        ? Number(promo.montoFijo)
        : promo.monto_fijo !== undefined && promo.monto_fijo !== null
          ? Number(promo.monto_fijo)
          : null,
    fechaInicio: String(promo.fechaInicio ?? promo.fecha_inicio),
    fechaFin: String(promo.fechaFin ?? promo.fecha_fin),
    prioridad: Number(promo.prioridad ?? 1),
    montoMinimo: Number(promo.montoMinimo ?? promo.monto_minimo ?? 0),
    categoriaId: promo.categoriaId ?? promo.categoria_id ?? null,
    categoriaCodigo: promo.categoriaCodigo ?? promo.categoria_codigo ?? null,
    articuloId: promo.articuloId ?? promo.articulo_id ?? null,
    sku: promo.sku ?? null,
    tramos
  };
}

function lineaCumpleFiltros(linea, promo) {
  const tieneFiltroCategoria = promo.categoriaId !== null || promo.categoriaCodigo !== null;
  if (tieneFiltroCategoria) {
    const coincideId = promo.categoriaId !== null && linea.categoriaId !== null && linea.categoriaId === promo.categoriaId;
    const coincideCodigo =
      promo.categoriaCodigo !== null &&
      linea.categoriaCodigo !== null &&
      linea.categoriaCodigo === promo.categoriaCodigo;
    if (!coincideId && !coincideCodigo) {
      return false;
    }
  }

  const tieneFiltroSku = promo.articuloId !== null || promo.sku !== null;
  if (tieneFiltroSku) {
    const coincideArticuloId =
      promo.articuloId !== null && linea.articuloId !== null && linea.articuloId === promo.articuloId;
    const coincideSku = promo.sku !== null && linea.sku !== null && linea.sku === promo.sku;
    if (!coincideArticuloId && !coincideSku) {
      return false;
    }
  }

  return true;
}

function construirSnapshotConfiguracion(promo) {
  return {
    codigo: promo.codigo,
    nombre: promo.nombre,
    tipo: promo.tipo,
    tasaBps: promo.tasaBps,
    montoFijo: promo.montoFijo,
    fechaInicio: promo.fechaInicio,
    fechaFin: promo.fechaFin,
    prioridad: promo.prioridad,
    montoMinimo: promo.montoMinimo,
    categoriaId: promo.categoriaId,
    categoriaCodigo: promo.categoriaCodigo,
    articuloId: promo.articuloId,
    sku: promo.sku,
    tramos: promo.tramos
  };
}

/**
 * Evalúa una promoción individual antes de competir contra las demás.
 */
function evaluarPromocionIndividual(promo, fechaOc, subtotalOc, lineas) {
  const configuracion = construirSnapshotConfiguracion(promo);

  // 1. Vigencia por fecha (inclusiva)
  if (fechaOc < promo.fechaInicio) {
    return {
      promocionId: promo.id,
      codigo: promo.codigo,
      nombre: promo.nombre,
      tipo: promo.tipo,
      prioridad: promo.prioridad,
      elegible: false,
      aplicada: false,
      ahorroPotencial: 0,
      motivo: MOTIVOS_EVALUACION.AUN_NO_VIGENTE,
      explicacion: `La promoción inicia el ${promo.fechaInicio} y la orden tiene fecha ${fechaOc}.`,
      configuracion
    };
  }

  if (fechaOc > promo.fechaFin) {
    return {
      promocionId: promo.id,
      codigo: promo.codigo,
      nombre: promo.nombre,
      tipo: promo.tipo,
      prioridad: promo.prioridad,
      elegible: false,
      aplicada: false,
      ahorroPotencial: 0,
      motivo: MOTIVOS_EVALUACION.VENCIDA,
      explicacion: `La promoción venció el ${promo.fechaFin} y la orden tiene fecha ${fechaOc}.`,
      configuracion
    };
  }

  // 2. Monto mínimo evaluado sobre el subtotal completo de la OC antes del descuento
  if (promo.montoMinimo > 0 && subtotalOc < promo.montoMinimo) {
    return {
      promocionId: promo.id,
      codigo: promo.codigo,
      nombre: promo.nombre,
      tipo: promo.tipo,
      prioridad: promo.prioridad,
      elegible: false,
      aplicada: false,
      ahorroPotencial: 0,
      motivo: MOTIVOS_EVALUACION.MONTO_INSUFICIENTE,
      explicacion: `El subtotal de la orden (₡${subtotalOc.toLocaleString('es-CR')}) es menor al mínimo requerido de ₡${promo.montoMinimo.toLocaleString('es-CR')}.`,
      configuracion
    };
  }

  // 3. Los tipos ESCALONADO y DOS_POR_UNO requieren obligatoriamente un filtro de SKU/artículo
  if (
    (promo.tipo === TIPOS_PROMOCION.ESCALONADO || promo.tipo === TIPOS_PROMOCION.DOS_POR_UNO) &&
    promo.articuloId === null &&
    promo.sku === null
  ) {
    return {
      promocionId: promo.id,
      codigo: promo.codigo,
      nombre: promo.nombre,
      tipo: promo.tipo,
      prioridad: promo.prioridad,
      elegible: false,
      aplicada: false,
      ahorroPotencial: 0,
      motivo: MOTIVOS_EVALUACION.SIN_LINEAS_ELEGIBLES,
      explicacion: `La promoción de tipo ${promo.tipo} requiere un SKU configurado.`,
      configuracion
    };
  }

  // 4. Filtrar líneas elegibles (categoría y SKU deben cumplirse en la misma línea)
  const lineasElegibles = lineas.filter((linea) => lineaCumpleFiltros(linea, promo));
  if (lineasElegibles.length === 0) {
    return {
      promocionId: promo.id,
      codigo: promo.codigo,
      nombre: promo.nombre,
      tipo: promo.tipo,
      prioridad: promo.prioridad,
      elegible: false,
      aplicada: false,
      ahorroPotencial: 0,
      motivo: MOTIVOS_EVALUACION.SIN_LINEAS_ELEGIBLES,
      explicacion: 'Ninguna línea de la orden coincide con los filtros de categoría o SKU de la promoción.',
      configuracion
    };
  }

  const subtotalElegible = lineasElegibles.reduce((acc, l) => acc + l.subtotalLinea, 0);
  const cantidadElegible = lineasElegibles.reduce((acc, l) => acc + l.cantidad, 0);

  let ahorroPotencial = 0;

  if (promo.tipo === TIPOS_PROMOCION.PORCENTAJE) {
    const descuento = calcularDescuentoPorcentual(subtotalElegible, promo.tasaBps ?? 0);
    ahorroPotencial = Math.min(subtotalElegible, descuento);
  } else if (promo.tipo === TIPOS_PROMOCION.MONTO_FIJO) {
    ahorroPotencial = Math.min(subtotalElegible, promo.montoFijo ?? 0);
  } else if (promo.tipo === TIPOS_PROMOCION.ESCALONADO) {
    const tramosAlcanzados = promo.tramos.filter((t) => cantidadElegible >= t.cantidadMinima);
    if (tramosAlcanzados.length === 0) {
      const minimoRequerido = promo.tramos.length > 0 ? promo.tramos[0].cantidadMinima : 0;
      return {
        promocionId: promo.id,
        codigo: promo.codigo,
        nombre: promo.nombre,
        tipo: promo.tipo,
        prioridad: promo.prioridad,
        elegible: false,
        aplicada: false,
        ahorroPotencial: 0,
        motivo: MOTIVOS_EVALUACION.TRAMO_NO_ALCANZADO,
        explicacion: `La cantidad acumulada del SKU (${cantidadElegible} uds.) no alcanza el tramo mínimo de ${minimoRequerido} unidades.`,
        configuracion
      };
    }
    const mayorTramo = tramosAlcanzados[tramosAlcanzados.length - 1];
    const descuento = calcularDescuentoPorcentual(subtotalElegible, mayorTramo.tasaBps);
    ahorroPotencial = Math.min(subtotalElegible, descuento);
  } else if (promo.tipo === TIPOS_PROMOCION.DOS_POR_UNO) {
    const unidadesGratis = Math.floor(cantidadElegible / 2);
    if (unidadesGratis <= 0) {
      return {
        promocionId: promo.id,
        codigo: promo.codigo,
        nombre: promo.nombre,
        tipo: promo.tipo,
        prioridad: promo.prioridad,
        elegible: false,
        aplicada: false,
        ahorroPotencial: 0,
        motivo: MOTIVOS_EVALUACION.SIN_AHORRO,
        explicacion: `Se requieren al menos 2 unidades del SKU elegible para aplicar 2×1 (cantidad actual: ${cantidadElegible}).`,
        configuracion
      };
    }

    // Ordenar líneas elegibles de menor a mayor precio unitario para tomar las más baratas como gratuitas
    const lineasOrdenadasPorPrecio = [...lineasElegibles].sort(
      (a, b) => a.precioUnitario - b.precioUnitario
    );
    let restantesGratis = unidadesGratis;
    let ahorroAcumulado = 0;

    for (const linea of lineasOrdenadasPorPrecio) {
      if (restantesGratis <= 0) break;
      const unidadesTomadas = Math.min(restantesGratis, linea.cantidad);
      ahorroAcumulado += unidadesTomadas * linea.precioUnitario;
      restantesGratis -= unidadesTomadas;
    }

    ahorroPotencial = Math.min(subtotalElegible, ahorroAcumulado);
  }

  if (ahorroPotencial <= 0) {
    return {
      promocionId: promo.id,
      codigo: promo.codigo,
      nombre: promo.nombre,
      tipo: promo.tipo,
      prioridad: promo.prioridad,
      elegible: false,
      aplicada: false,
      ahorroPotencial: 0,
      motivo: MOTIVOS_EVALUACION.SIN_AHORRO,
      explicacion: 'La promoción no genera un ahorro positivo sobre las líneas elegibles.',
      configuracion
    };
  }

  return {
    promocionId: promo.id,
    codigo: promo.codigo,
    nombre: promo.nombre,
    tipo: promo.tipo,
    prioridad: promo.prioridad,
    elegible: true,
    aplicada: false,
    ahorroPotencial,
    motivo: '',
    explicacion: '',
    configuracion
  };
}

/**
 * Evalúa todas las promociones del proveedor para una orden de compra.
 * @param {object} orden
 * @param {string} orden.fecha Fecha de la OC en formato YYYY-MM-DD (también acepta `fecha_oc`)
 * @param {Array<object>} orden.lineas Líneas de la OC
 * @param {Array<object>} promociones Lista de promociones del proveedor
 */
export function evaluarPromocionesOrden(orden, promociones = []) {
  const fechaOc = String(orden.fecha ?? orden.fecha_oc ?? '');
  const lineas = (orden.lineas ?? []).map(normalizarLinea);
  const subtotal = lineas.reduce((acc, l) => acc + l.subtotalLinea, 0);

  const promosNormalizadas = promociones.map(normalizarPromocion);
  const evaluaciones = promosNormalizadas.map((promo) =>
    evaluarPromocionIndividual(promo, fechaOc, subtotal, lineas)
  );

  // Filtrar candidatas con ahorro positivo y ordenarlas según reglas de negocio:
  // 1. Mayor ahorro positivo
  // 2. Mayor prioridad
  // 3. Código en orden alfabético ascendente
  const candidatas = evaluaciones
    .filter((ev) => ev.elegible && ev.ahorroPotencial > 0)
    .sort((a, b) => {
      if (b.ahorroPotencial !== a.ahorroPotencial) {
        return b.ahorroPotencial - a.ahorroPotencial;
      }
      if (b.prioridad !== a.prioridad) {
        return b.prioridad - a.prioridad;
      }
      return a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0;
    });

  const ganadora = candidatas.length > 0 ? candidatas[0] : null;

  for (const ev of evaluaciones) {
    if (!ev.elegible) {
      continue;
    }
    if (ganadora && ev.codigo === ganadora.codigo) {
      ev.aplicada = true;
      ev.motivo = MOTIVOS_EVALUACION.APLICADA;
      ev.explicacion = `Promoción aplicada por generar el mayor ahorro (₡${ev.ahorroPotencial.toLocaleString('es-CR')}).`;
    } else if (ganadora && ev.ahorroPotencial < ganadora.ahorroPotencial) {
      ev.aplicada = false;
      ev.motivo = MOTIVOS_EVALUACION.MENOR_AHORRO;
      ev.explicacion = `Elegible con ahorro potencial de ₡${ev.ahorroPotencial.toLocaleString('es-CR')}, pero descartada frente a ${ganadora.codigo} (₡${ganadora.ahorroPotencial.toLocaleString('es-CR')}).`;
    } else if (ganadora) {
      ev.aplicada = false;
      ev.motivo = MOTIVOS_EVALUACION.DESEMPATE;
      ev.explicacion = `Empató en ahorro potencial (₡${ev.ahorroPotencial.toLocaleString('es-CR')}), pero fue descartada en el desempate frente a ${ganadora.codigo} (prioridad ${ganadora.prioridad}).`;
    }
  }

  const ahorro = ganadora ? ganadora.ahorroPotencial : 0;
  const totalNeto = subtotal - ahorro;

  return {
    subtotal,
    ahorro,
    ahorroTotal: ahorro,
    totalNeto,
    promocionAplicada: ganadora
      ? {
          id: ganadora.promocionId,
          codigo: ganadora.codigo,
          nombre: ganadora.nombre,
          tipo: ganadora.tipo,
          ahorro: ganadora.ahorroPotencial
        }
      : null,
    codigoPromocionAplicada: ganadora ? ganadora.codigo : null,
    evaluaciones
  };
}

