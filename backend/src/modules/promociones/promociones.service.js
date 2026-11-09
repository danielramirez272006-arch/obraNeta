import { ConflictError, ValidationError } from '../../http/errors.js';
import {
  isNonNegativeInteger,
  isPositiveInteger,
  isValidCalendarDate
} from '../../http/validators.js';
import { TIPOS_PROMOCION } from './motor-promociones.js';

export class PromocionesService {
  /**
   * @param {import('./promociones.repository.js').PromocionesRepository} repo
   */
  constructor(repo) {
    this.repo = repo;
  }

  listarPromociones(filtros = {}) {
    return this.repo.listar(filtros);
  }

  crearPromocion(payload = {}) {
    const fields = {};

    const proveedorId = Number(payload.proveedorId ?? payload.proveedor_id);
    if (!isPositiveInteger(proveedorId)) {
      fields.proveedorId = 'Debe seleccionar un proveedor válido.';
    } else if (!this.repo.obtenerProveedor(proveedorId)) {
      fields.proveedorId = 'El proveedor indicado no existe.';
    }

    const codigoRaw = typeof payload.codigo === 'string' ? payload.codigo.trim().toUpperCase() : '';
    if (!codigoRaw) {
      fields.codigo = 'El código de la promoción es obligatorio.';
    } else if (!/^[A-Z0-9_-]{2,32}$/.test(codigoRaw)) {
      fields.codigo = 'El código debe tener entre 2 y 32 caracteres alfanuméricos, guiones o guion bajo.';
    }

    const nombreRaw =
      typeof payload.nombre === 'string' && payload.nombre.trim()
        ? payload.nombre.trim()
        : codigoRaw;
    if (!nombreRaw) {
      fields.nombre = 'El nombre o descripción de la promoción es obligatorio.';
    }

    const tipo = typeof payload.tipo === 'string' ? payload.tipo.trim().toUpperCase() : '';
    const tiposValidos = Object.values(TIPOS_PROMOCION);
    if (!tiposValidos.includes(tipo)) {
      fields.tipo = 'El tipo de promoción debe ser PORCENTAJE, MONTO_FIJO, ESCALONADO o DOS_POR_UNO.';
    }

    const fechaInicio = payload.fechaInicio ?? payload.fecha_inicio;
    const fechaFin = payload.fechaFin ?? payload.fecha_fin;

    if (!isValidCalendarDate(fechaInicio)) {
      fields.fechaInicio = 'La fecha de inicio debe ser una fecha calendario válida (YYYY-MM-DD).';
    }
    if (!isValidCalendarDate(fechaFin)) {
      fields.fechaFin = 'La fecha de fin debe ser una fecha calendario válida (YYYY-MM-DD).';
    }
    if (isValidCalendarDate(fechaInicio) && isValidCalendarDate(fechaFin) && fechaInicio > fechaFin) {
      fields.fechaFin = 'La fecha de fin no puede ser anterior a la fecha de inicio.';
    }

    const prioridadRaw =
      payload.prioridad !== undefined && payload.prioridad !== '' ? Number(payload.prioridad) : 1;
    if (!Number.isInteger(prioridadRaw) || prioridadRaw < 1) {
      fields.prioridad = 'La prioridad debe ser un número entero positivo (mínimo 1).';
    }

    const montoMinimoRaw =
      payload.montoMinimo !== undefined && payload.montoMinimo !== null && payload.montoMinimo !== ''
        ? Number(payload.montoMinimo)
        : payload.monto_minimo !== undefined && payload.monto_minimo !== null && payload.monto_minimo !== ''
          ? Number(payload.monto_minimo)
          : 0;

    if (!isNonNegativeInteger(montoMinimoRaw)) {
      fields.montoMinimo = 'El monto mínimo debe ser un importe entero en colones mayor o igual a 0.';
    }

    // Validar filtro opcional de categoría
    let categoriaId = null;
    const rawCatId = payload.categoriaId ?? payload.categoria_id;
    if (rawCatId !== undefined && rawCatId !== null && rawCatId !== '') {
      const parsedCatId = Number(rawCatId);
      if (!isPositiveInteger(parsedCatId) || !this.repo.obtenerCategoria(parsedCatId)) {
        fields.categoriaId = 'La categoría seleccionada no existe.';
      } else {
        categoriaId = parsedCatId;
      }
    }

    // Validar filtro de artículo / SKU
    let articuloId = null;
    const rawArticuloId = payload.articuloId ?? payload.articulo_id;
    const rawSku = typeof payload.sku === 'string' && payload.sku.trim() ? payload.sku.trim() : null;

    if (rawArticuloId !== undefined && rawArticuloId !== null && rawArticuloId !== '') {
      const parsedArt = Number(rawArticuloId);
      const art = isPositiveInteger(parsedArt) ? this.repo.obtenerArticuloPorId(parsedArt) : null;
      if (!art) {
        fields.articuloId = 'El artículo seleccionado no existe.';
      } else {
        articuloId = art.id;
      }
    } else if (rawSku) {
      const art = this.repo.obtenerArticuloPorSku(rawSku);
      if (!art) {
        fields.sku = `No existe ningún artículo con el SKU "${rawSku}".`;
        fields.articuloId = fields.sku;
      } else {
        articuloId = art.id;
      }
    }

    // Validar configuración específica según el tipo
    let tasaBps = null;
    let montoFijo = null;
    const tramosValidados = [];

    if (tipo === TIPOS_PROMOCION.PORCENTAJE) {
      const rawTasa = payload.tasaBps ?? payload.tasa_bps;
      if (rawTasa === undefined || rawTasa === null || rawTasa === '') {
        fields.tasaBps = 'La tasa en puntos básicos es obligatoria para promociones de porcentaje.';
      } else {
        const parsedTasa = Number(rawTasa);
        if (!isPositiveInteger(parsedTasa) || parsedTasa > 10000) {
          fields.tasaBps = 'La tasa debe ser un entero entre 1 y 10000 puntos básicos (0.01% a 100%).';
        } else {
          tasaBps = parsedTasa;
        }
      }
    } else if (tipo === TIPOS_PROMOCION.MONTO_FIJO) {
      const rawMontoFijo = payload.montoFijo ?? payload.monto_fijo;
      if (rawMontoFijo === undefined || rawMontoFijo === null || rawMontoFijo === '') {
        fields.montoFijo = 'El monto fijo de descuento en colones es obligatorio.';
      } else {
        const parsedMonto = Number(rawMontoFijo);
        if (!isPositiveInteger(parsedMonto)) {
          fields.montoFijo = 'El monto fijo debe ser un entero positivo en colones (> 0).';
        } else {
          montoFijo = parsedMonto;
        }
      }
    } else if (tipo === TIPOS_PROMOCION.ESCALONADO) {
      if (!articuloId && !fields.articuloId && !fields.sku) {
        fields.articuloId = 'Las promociones por tramos (ESCALONADO) requieren seleccionar un artículo (SKU).';
        fields.sku = fields.articuloId;
      }

      const rawTramos = payload.tramos;
      if (!Array.isArray(rawTramos) || rawTramos.length === 0) {
        fields.tramos = 'Debe definir al menos un tramo de volumen con cantidad mínima y tasa.';
      } else {
        const cantidadesVistas = new Set();
        rawTramos.forEach((tramo, idx) => {
          const cantMin = Number(tramo?.cantidadMinima ?? tramo?.cantidad_minima);
          const tasaTramo = Number(tramo?.tasaBps ?? tramo?.tasa_bps);
          if (!isPositiveInteger(cantMin)) {
            fields.tramos = `El tramo #${idx + 1} debe tener una cantidad mínima entera positiva.`;
          } else if (cantidadesVistas.has(cantMin)) {
            fields.tramos = `La cantidad mínima ${cantMin} está repetida en los tramos.`;
          } else {
            cantidadesVistas.add(cantMin);
          }

          if (!isPositiveInteger(tasaTramo) || tasaTramo > 10000) {
            fields.tramos = `El tramo #${idx + 1} debe tener una tasa entre 1 y 10000 puntos básicos.`;
          }

          if (!fields.tramos) {
            tramosValidados.push({
              cantidadMinima: cantMin,
              tasaBps: tasaTramo
            });
          }
        });
      }
    } else if (tipo === TIPOS_PROMOCION.DOS_POR_UNO) {
      if (!articuloId && !fields.articuloId && !fields.sku) {
        fields.articuloId = 'Las promociones 2×1 (DOS_POR_UNO) requieren seleccionar un artículo (SKU).';
        fields.sku = fields.articuloId;
      }
    }

    if (Object.keys(fields).length > 0) {
      throw new ValidationError('No se pudo registrar la promoción. Revise los campos marcados.', fields);
    }

    const existente = this.repo.buscarPorProveedorYCodigo(proveedorId, codigoRaw);
    if (existente) {
      throw new ConflictError(
        `Ya existe una promoción con el código "${codigoRaw}" para el proveedor seleccionado.`,
        { codigo: `El código "${codigoRaw}" ya está registrado para este proveedor.` }
      );
    }

    return this.repo.crear({
      proveedorId,
      codigo: codigoRaw,
      nombre: nombreRaw,
      tipo,
      tasaBps,
      montoFijo,
      fechaInicio,
      fechaFin,
      prioridad: prioridadRaw,
      montoMinimo: montoMinimoRaw,
      categoriaId,
      articuloId,
      tramos: tramosValidados
    });
  }
}

