import type { MotivoEvaluacion, Promocion, TipoPromocion } from '../api/types';

/**
 * Formatea un monto en colones enteros con el símbolo ₡ y espacios como separador de miles
 * (ej. 63000 -> "₡63 000", 1197000 -> "₡1 197 000").
 */
export function formatCRC(amount: number | null | undefined): string {
  const num = Number(amount ?? 0);
  if (!Number.isFinite(num)) {
    return '₡0';
  }
  const rounded = Math.round(num);
  const absStr = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return rounded < 0 ? `-₡${absStr}` : `₡${absStr}`;
}

export function formatPorcentajeBps(bps: number | null | undefined): string {
  if (bps === null || bps === undefined) return '—';
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)} % (${bps} bps)`;
}

export function etiquetaTipoPromocion(tipo: TipoPromocion): string {
  switch (tipo) {
    case 'PORCENTAJE':
      return 'Porcentaje (PORCENTAJE)';
    case 'MONTO_FIJO':
      return 'Monto fijo (MONTO_FIJO)';
    case 'ESCALONADO':
      return 'Por tramos de volumen (ESCALONADO)';
    case 'DOS_POR_UNO':
      return '2×1 en unidades (DOS_POR_UNO)';
    default:
      return tipo;
  }
}

export function describirBeneficioPromocion(promo: Pick<Promocion, 'tipo' | 'tasaBps' | 'montoFijo' | 'tramos'>): string {
  if (promo.tipo === 'PORCENTAJE') {
    return `${formatPorcentajeBps(promo.tasaBps)} sobre subtotal elegible`;
  }
  if (promo.tipo === 'MONTO_FIJO') {
    return `${formatCRC(promo.montoFijo)} de descuento fijo`;
  }
  if (promo.tipo === 'ESCALONADO') {
    if (!promo.tramos || promo.tramos.length === 0) return 'Tramos por volumen';
    return promo.tramos
      .map((t) => `≥ ${t.cantidadMinima} uds: ${t.tasaBps / 100}%`)
      .join(' · ');
  }
  if (promo.tipo === 'DOS_POR_UNO') {
    return '2×1 (1 unidad gratis por cada par elegible)';
  }
  return '';
}

export function etiquetaMotivoEvaluacion(motivo: MotivoEvaluacion): string {
  switch (motivo) {
    case 'APLICADA':
      return 'APLICADA — Ganadora por mayor beneficio';
    case 'MENOR_AHORRO':
      return 'MENOR_AHORRO — Elegible, superada por otra promoción';
    case 'VENCIDA':
      return 'VENCIDA — Fuera de vigencia (expirada)';
    case 'AUN_NO_VIGENTE':
      return 'AUN_NO_VIGENTE — Vigencia futura';
    case 'MONTO_INSUFICIENTE':
      return 'MONTO_INSUFICIENTE — No alcanza el subtotal mínimo';
    case 'SIN_LINEAS_ELEGIBLES':
      return 'SIN_LINEAS_ELEGIBLES — Sin artículos/categorías aplicables';
    case 'TRAMO_NO_ALCANZADO':
      return 'TRAMO_NO_ALCANZADO — Cantidad menor al primer tramo';
    case 'SIN_AHORRO':
      return 'SIN_AHORRO — No genera ahorro positivo';
    case 'DESEMPATE':
      return 'DESEMPATE — Descartada por prioridad o código alfabético';
    default:
      return motivo;
  }
}

