import { ConflictError, NotFoundError, ValidationError } from '../../http/errors.js';
import {
  isNonNegativeInteger,
  isPositiveInteger,
  isValidCalendarDate
} from '../../http/validators.js';
import { evaluarPromocionesOrden } from '../promociones/motor-promociones.js';

export class OrdenesService {
  /**
   * @param {import('./ordenes.repository.js').OrdenesRepository} ordenesRepo
   * @param {import('../promociones/promociones.repository.js').PromocionesRepository} promocionesRepo
   */
  constructor(ordenesRepo, promocionesRepo) {
    this.ordenesRepo = ordenesRepo;
    this.promocionesRepo = promocionesRepo;
  }

  listarOrdenes() {
    return this.ordenesRepo.listar();
  }

  obtenerOrden(id) {
    const ordenId = Number(id);
    if (!isPositiveInteger(ordenId)) {
      throw new ValidationError('El identificador de la orden no es válido.', {
        id: 'ID inválido.'
      });
    }
    const orden = this.ordenesRepo.obtenerPorId(ordenId);
    if (!orden) {
      throw new NotFoundError(`No se encontró la orden de compra con ID ${ordenId}.`);
    }
    return orden;
  }

  obtenerAuditoriaOrden(id) {
    const ordenId = Number(id);
    if (!isPositiveInteger(ordenId)) {
      throw new ValidationError('El identificador de la orden no es válido.', {
        id: 'ID inválido.'
      });
    }
    const auditoria = this.ordenesRepo.obtenerAuditoriaPorOrdenId(ordenId);
    if (!auditoria) {
      throw new NotFoundError(`No se encontró la orden de compra con ID ${ordenId}.`);
    }
    return auditoria;
  }

  registrarOrden(payload = {}, options = {}) {
    const fields = {};

    const numeroOcRaw = payload.numeroOc ?? payload.numero_oc ?? '';
    const numeroOc = typeof numeroOcRaw === 'string' ? numeroOcRaw.trim() : '';
    if (!numeroOc) {
      fields.numeroOc = 'El número de orden de compra (OC) es obligatorio.';
    }

    const fechaOc = payload.fechaOc ?? payload.fecha_oc ?? payload.fecha ?? '';
    if (!isValidCalendarDate(fechaOc)) {
      fields.fechaOc = 'La fecha de la orden debe ser una fecha calendario válida (YYYY-MM-DD).';
    }

    let proveedor = null;
    const rawProveedorId = payload.proveedorId ?? payload.proveedor_id;
    const rawProveedorCodigo = payload.proveedorCodigo ?? payload.proveedor_codigo;

    if (rawProveedorId !== undefined && rawProveedorId !== null && rawProveedorId !== '') {
      const parsedId = Number(rawProveedorId);
      if (isPositiveInteger(parsedId)) {
        proveedor = this.ordenesRepo.obtenerProveedor(parsedId);
      }
    } else if (typeof rawProveedorCodigo === 'string' && rawProveedorCodigo.trim()) {
      proveedor = this.ordenesRepo.obtenerProveedorPorCodigo(rawProveedorCodigo.trim());
    }

    if (!proveedor) {
      fields.proveedorId = 'Debe seleccionar un proveedor existente.';
    }

    const rawLineas = payload.lineas;
    const lineasEnriquecidas = [];

    if (!Array.isArray(rawLineas) || rawLineas.length === 0) {
      fields.lineas = 'La orden de compra debe incluir al menos una línea de artículo.';
    } else {
      rawLineas.forEach((linea, idx) => {
        let articulo = null;
        const rawArtId = linea?.articuloId ?? linea?.articulo_id;
        const rawSku = typeof linea?.sku === 'string' ? linea.sku.trim() : '';

        if (rawArtId !== undefined && rawArtId !== null && rawArtId !== '') {
          const parsedArtId = Number(rawArtId);
          if (isPositiveInteger(parsedArtId)) {
            articulo = this.ordenesRepo.obtenerArticuloPorId(parsedArtId);
          }
        } else if (rawSku) {
          articulo = this.ordenesRepo.obtenerArticuloPorSku(rawSku);
        }

        if (!articulo) {
          fields[`lineas.${idx}.articuloId`] = `Seleccione un artículo válido en la línea #${idx + 1}.`;
        }

        const cantidad = Number(linea?.cantidad);
        if (!isPositiveInteger(cantidad)) {
          fields[`lineas.${idx}.cantidad`] = `La cantidad en la línea #${idx + 1} debe ser un entero positivo (> 0).`;
        }

        const rawPrecio = linea?.precioUnitario ?? linea?.precio_unitario;
        const precioUnitario =
          rawPrecio !== undefined && rawPrecio !== null && rawPrecio !== '' ? Number(rawPrecio) : NaN;
        if (!isNonNegativeInteger(precioUnitario)) {
          fields[`lineas.${idx}.precioUnitario`] = `El precio unitario en la línea #${idx + 1} debe ser un entero mayor o igual a 0.`;
        }

        if (articulo && isPositiveInteger(cantidad) && isNonNegativeInteger(precioUnitario)) {
          lineasEnriquecidas.push({
            articuloId: articulo.id,
            sku: articulo.sku,
            articuloNombre: articulo.nombre,
            categoriaId: articulo.categoriaId,
            categoriaCodigo: articulo.categoriaCodigo,
            cantidad,
            precioUnitario,
            subtotalLinea: cantidad * precioUnitario
          });
        }
      });
    }

    if (Object.keys(fields).length > 0) {
      if (!fields.lineas) {
        const primerErrorLinea = Object.keys(fields).find((k) => k.startsWith('lineas.'));
        if (primerErrorLinea) {
          fields.lineas = fields[primerErrorLinea];
        }
      }
      throw new ValidationError('No se pudo registrar la orden. Revise los datos ingresados.', fields);
    }

    // Verificar duplicidad de número de OC (HTTP 409)
    const ordenExistente = this.ordenesRepo.buscarPorNumeroOc(numeroOc);
    if (ordenExistente) {
      throw new ConflictError(`El número de orden de compra "${numeroOc}" ya se encuentra registrado.`, {
        numeroOc: `El número de OC "${numeroOc}" ya existe.`
      });
    }

    // Obtener todas las promociones del proveedor y evaluar con el motor puro
    const promocionesProveedor = this.promocionesRepo.listar({ proveedorId: proveedor.id });
    const resultadoMotor = evaluarPromocionesOrden(
      {
        fecha: fechaOc,
        lineas: lineasEnriquecidas
      },
      promocionesProveedor
    );

    const ordenGuardada = this.ordenesRepo.guardarOrdenCompleta({
      numeroOc,
      proveedorId: proveedor.id,
      fechaOc,
      subtotal: resultadoMotor.subtotal,
      promocionAplicadaId: resultadoMotor.promocionAplicada?.id ?? null,
      codigoPromocionAplicada: resultadoMotor.codigoPromocionAplicada,
      ahorroTotal: resultadoMotor.ahorro,
      totalNeto: resultadoMotor.totalNeto,
      lineas: lineasEnriquecidas,
      evaluaciones: resultadoMotor.evaluaciones,
      beforeCommitHook: options.beforeCommitHook
    });

    const auditoria = this.ordenesRepo.obtenerAuditoriaPorOrdenId(ordenGuardada.id);

    return {
      ...ordenGuardada,
      promocionAplicada: resultadoMotor.promocionAplicada,
      auditoria: auditoria.evaluaciones
    };
  }
}

