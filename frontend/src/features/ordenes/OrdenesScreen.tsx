import React, { useState } from 'react';
import { apiClient, ApiClientError } from '../../api/client';
import type {
  Articulo,
  OrdenDetalle,
  OrdenResumen,
  Proveedor
} from '../../api/types';
import { AlertBanner } from '../../components/AlertBanner';
import { EmptyState } from '../../components/EmptyState';
import { FormFieldError } from '../../components/FormFieldError';
import { formatCRC } from '../../components/formatters';

interface LineaFormState {
  articuloId: string;
  cantidad: string;
  precioUnitario: string;
}

interface OrdenesScreenProps {
  proveedores: Proveedor[];
  articulos: Articulo[];
  ordenes: OrdenResumen[];
  onOrdenCreated: (orden: OrdenDetalle) => void;
  onOpenAuditoria: (ordenId: number) => void;
}

export const OrdenesScreen: React.FC<OrdenesScreenProps> = ({
  proveedores,
  articulos,
  ordenes,
  onOrdenCreated,
  onOpenAuditoria
}) => {
  const calcularNumeroSugerido = (listaOrdenes: OrdenResumen[]) => {
    const numerosExistentes = new Set(listaOrdenes.map((o) => o.numeroOc));
    let sugerido = 'OC-2026-001';
    let contador = 2;
    while (numerosExistentes.has(sugerido)) {
      sugerido = `OC-2026-${String(contador).padStart(3, '0')}`;
      contador += 1;
    }
    return sugerido;
  };

  const defaultProveedorId = proveedores[0]?.id ? String(proveedores[0].id) : '';
  const defaultArticulo = articulos[0];

  const [numeroOc, setNumeroOc] = useState(() => calcularNumeroSugerido(ordenes));
  const [fechaOc, setFechaOc] = useState('2026-10-15');
  const [proveedorId, setProveedorId] = useState(defaultProveedorId);
  const [lineas, setLineas] = useState<LineaFormState[]>([
    {
      articuloId: defaultArticulo ? String(defaultArticulo.id) : '',
      cantidad: '1',
      precioUnitario: defaultArticulo ? String(defaultArticulo.precioSugerido) : '0'
    }
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [ultimaOrdenConfirmada, setUltimaOrdenConfirmada] = useState<OrdenDetalle | null>(null);

  const calcularSubtotalPreliminar = (): number => {
    return lineas.reduce((acc, l) => {
      const cant = Number(l.cantidad);
      const precio = Number(l.precioUnitario);
      if (Number.isFinite(cant) && cant > 0 && Number.isFinite(precio) && precio >= 0) {
        return acc + Math.trunc(cant) * Math.trunc(precio);
      }
      return acc;
    }, 0);
  };

  const handleCargarEjemploCemento = () => {
    const provA =
      proveedores.find((p) => p.codigo === 'PROV-A' || p.nombre === 'Proveedor A') ??
      proveedores[0];
    const cemGris =
      articulos.find((a) => a.sku === 'CEM-GRIS-50') ?? articulos[0];

    // Sugerir número de OC disponible
    const sugerido = calcularNumeroSugerido(ordenes);
    setNumeroOc(sugerido);
    setFechaOc('2026-10-15');
    if (provA) setProveedorId(String(provA.id));
    if (cemGris) {
      setLineas([
        {
          articuloId: String(cemGris.id),
          cantidad: '200',
          precioUnitario: '6300'
        }
      ]);
    }
    setFieldErrors({});
    setBannerError(null);
    setInfoMessage(
      'Ejemplo de cemento cargado (200 sacos de CEM-GRIS-50 a ₡6 300 del 2026-10-15 para el Proveedor A). Revise los datos y presione «Registrar orden de compra».'
    );
  };

  const handleAgregarLinea = () => {
    const primerArt = articulos[0];
    setLineas((prev) => [
      ...prev,
      {
        articuloId: primerArt ? String(primerArt.id) : '',
        cantidad: '1',
        precioUnitario: primerArt ? String(primerArt.precioSugerido) : '0'
      }
    ]);
  };

  const handleEliminarLinea = (index: number) => {
    if (lineas.length <= 1) return;
    setLineas((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCambioArticuloLinea = (index: number, nuevoArticuloId: string) => {
    const art = articulos.find((a) => String(a.id) === nuevoArticuloId);
    setLineas((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              articuloId: nuevoArticuloId,
              precioUnitario: art ? String(art.precioSugerido) : item.precioUnitario
            }
          : item
      )
    );
  };

  const handleCambioCampoLinea = (
    index: number,
    campo: 'cantidad' | 'precioUnitario',
    valor: string
  ) => {
    setLineas((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [campo]: valor } : item))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setFieldErrors({});
    setBannerError(null);
    setInfoMessage(null);

    try {
      const payload = {
        numeroOc: numeroOc.trim(),
        fechaOc: fechaOc.trim(),
        proveedorId: Number(proveedorId),
        lineas: lineas.map((l) => ({
          articuloId: Number(l.articuloId),
          cantidad: Number(l.cantidad),
          precioUnitario: Number(l.precioUnitario)
        }))
      };

      const creada = await apiClient.crearOrden(payload);
      setUltimaOrdenConfirmada(creada);
      onOrdenCreated(creada);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setBannerError(err.message);
        setFieldErrors(err.fields);
      } else {
        setBannerError('Ocurrió un error inesperado al guardar la orden de compra.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const subtotalPreliminar = calcularSubtotalPreliminar();

  return (
    <div className="screen-stack">
      <section className="panel" aria-labelledby="titulo-nueva-oc">
        <div className="panel-header">
          <div>
            <h2 id="titulo-nueva-oc">Registrar Orden de Compra (OC)</h2>
            <p className="panel-subtitle">
              Ingrese los datos de la orden o cargue el caso de demostración de cemento para evaluar promociones automáticamente.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCargarEjemploCemento}
            data-testid="btn-cargar-ejemplo-cemento"
          >
            Cargar ejemplo de cemento
          </button>
        </div>

        {infoMessage && (
          <AlertBanner
            variant="info"
            message={infoMessage}
            onClose={() => setInfoMessage(null)}
          />
        )}

        {bannerError && (
          <AlertBanner
            variant="error"
            title="Error al registrar la orden"
            message={bannerError}
            onClose={() => setBannerError(null)}
          />
        )}

        <form onSubmit={handleSubmit} noValidate className="oc-form">
          <div className="form-grid-3">
            <div className="form-group">
              <label htmlFor="input-numero-oc">Número de OC</label>
              <input
                id="input-numero-oc"
                type="text"
                value={numeroOc}
                onChange={(e) => setNumeroOc(e.target.value)}
                placeholder="Ej. OC-2026-001"
                required
                aria-invalid={Boolean(fieldErrors.numeroOc)}
              />
              <FormFieldError error={fieldErrors.numeroOc} />
            </div>

            <div className="form-group">
              <label htmlFor="input-fecha-oc">Fecha de la orden</label>
              <input
                id="input-fecha-oc"
                type="date"
                value={fechaOc}
                onChange={(e) => setFechaOc(e.target.value)}
                required
                aria-invalid={Boolean(fieldErrors.fechaOc)}
              />
              <FormFieldError error={fieldErrors.fechaOc} />
            </div>

            <div className="form-group">
              <label htmlFor="select-proveedor-oc">Proveedor</label>
              <select
                id="select-proveedor-oc"
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
                required
                aria-invalid={Boolean(fieldErrors.proveedorId)}
              >
                <option value="">Seleccione un proveedor...</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({p.codigo})
                  </option>
                ))}
              </select>
              <FormFieldError error={fieldErrors.proveedorId} />
            </div>
          </div>

          <div className="lines-section">
            <div className="lines-header">
              <h3>Líneas de artículos</h3>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleAgregarLinea}
              >
                + Agregar línea
              </button>
            </div>

            {fieldErrors.lineas && <FormFieldError error={fieldErrors.lineas} />}

            <div className="lines-list">
              {lineas.map((linea, idx) => {
                const subLinea =
                  Math.max(0, Math.trunc(Number(linea.cantidad) || 0)) *
                  Math.max(0, Math.trunc(Number(linea.precioUnitario) || 0));

                return (
                  <div className="line-row" key={idx}>
                    <div className="form-group line-col-article">
                      <label htmlFor={`linea-articulo-${idx}`}>
                        Artículo (Línea #{idx + 1})
                      </label>
                      <select
                        id={`linea-articulo-${idx}`}
                        value={linea.articuloId}
                        onChange={(e) => handleCambioArticuloLinea(idx, e.target.value)}
                      >
                        <option value="">Seleccione artículo...</option>
                        {articulos.map((art) => (
                          <option key={art.id} value={art.id}>
                            {art.sku} — {art.nombre} ({art.categoriaNombre})
                          </option>
                        ))}
                      </select>
                      <FormFieldError error={fieldErrors[`lineas.${idx}.articuloId`]} />
                    </div>

                    <div className="form-group line-col-qty">
                      <label htmlFor={`linea-cantidad-${idx}`}>Cantidad</label>
                      <input
                        id={`linea-cantidad-${idx}`}
                        type="number"
                        min={1}
                        step={1}
                        value={linea.cantidad}
                        onChange={(e) =>
                          handleCambioCampoLinea(idx, 'cantidad', e.target.value)
                        }
                      />
                      <FormFieldError error={fieldErrors[`lineas.${idx}.cantidad`]} />
                    </div>

                    <div className="form-group line-col-price">
                      <label htmlFor={`linea-precio-${idx}`}>Precio unitario (CRC)</label>
                      <input
                        id={`linea-precio-${idx}`}
                        type="number"
                        min={0}
                        step={1}
                        value={linea.precioUnitario}
                        onChange={(e) =>
                          handleCambioCampoLinea(idx, 'precioUnitario', e.target.value)
                        }
                      />
                      <FormFieldError error={fieldErrors[`lineas.${idx}.precioUnitario`]} />
                    </div>

                    <div className="line-col-subtotal">
                      <span className="line-subtotal-label">Subtotal línea</span>
                      <strong className="line-subtotal-value">{formatCRC(subLinea)}</strong>
                    </div>

                    <div className="line-col-actions">
                      <button
                        type="button"
                        className="btn btn-danger-outline btn-sm"
                        onClick={() => handleEliminarLinea(idx)}
                        disabled={lineas.length <= 1}
                        aria-label={`Eliminar línea ${idx + 1}`}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="form-footer">
            <div className="preliminary-box" data-testid="subtotal-preliminar">
              <span>Subtotal preliminar (sin descuento):</span>
              <strong>{formatCRC(subtotalPreliminar)}</strong>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              data-testid="btn-guardar-orden"
            >
              {submitting ? 'Guardando orden...' : 'Registrar orden de compra'}
            </button>
          </div>
        </form>
      </section>

      {ultimaOrdenConfirmada && (
        <section
          className="panel result-panel"
          aria-labelledby="titulo-resultado-oc"
          data-testid="resultado-orden-confirmada"
        >
          <div className="panel-header">
            <div>
              <span className="badge badge-success">Orden registrada con éxito</span>
              <h2 id="titulo-resultado-oc">
                Resultado confirmado — {ultimaOrdenConfirmada.numeroOc}
              </h2>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onOpenAuditoria(ultimaOrdenConfirmada.id)}
              data-testid="btn-ver-auditoria-confirmada"
            >
              Abrir auditoría de la orden
            </button>
          </div>

          <div className="summary-grid">
            <div className="summary-card">
              <span className="summary-label">Subtotal</span>
              <strong className="summary-value" data-testid="resultado-subtotal">
                {formatCRC(ultimaOrdenConfirmada.subtotal)}
              </strong>
            </div>

            <div className="summary-card highlight-success">
              <span className="summary-label">Promoción aplicada</span>
              <strong className="summary-value" data-testid="resultado-promocion">
                {ultimaOrdenConfirmada.codigoAplicado ?? 'Sin promoción aplicable'}
              </strong>
            </div>

            <div className="summary-card highlight-success">
              <span className="summary-label">Ahorro aplicado</span>
              <strong className="summary-value" data-testid="resultado-ahorro">
                {formatCRC(ultimaOrdenConfirmada.ahorro)}
              </strong>
            </div>

            <div className="summary-card highlight-primary">
              <span className="summary-label">Total neto</span>
              <strong className="summary-value" data-testid="resultado-total-neto">
                {formatCRC(ultimaOrdenConfirmada.totalNeto)}
              </strong>
            </div>
          </div>
        </section>
      )}

      <section className="panel" aria-labelledby="titulo-ordenes-guardadas">
        <div className="panel-header">
          <div>
            <h2 id="titulo-ordenes-guardadas">Órdenes de Compra Guardadas</h2>
            <p className="panel-subtitle">
              Historial de órdenes procesadas. Puede abrir la auditoría de cualquiera en cualquier momento.
            </p>
          </div>
        </div>

        {ordenes.length === 0 ? (
          <EmptyState
            title="No hay órdenes registradas todavía"
            description="Use el botón «Cargar ejemplo de cemento» arriba y envíe el formulario para registrar la primera orden."
          />
        ) : (
          <div className="table-responsive">
            <table className="data-table" data-testid="tabla-ordenes-guardadas">
              <thead>
                <tr>
                  <th>Número OC</th>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th className="num">Subtotal</th>
                  <th>Promoción aplicada</th>
                  <th className="num">Ahorro</th>
                  <th className="num">Total neto</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map((oc) => (
                  <tr key={oc.id}>
                    <td>
                      <strong>{oc.numeroOc}</strong>
                    </td>
                    <td>{oc.fechaOc}</td>
                    <td>{oc.proveedorNombre}</td>
                    <td className="num">{formatCRC(oc.subtotal)}</td>
                    <td>
                      {oc.codigoAplicado ? (
                        <span className="badge badge-success">{oc.codigoAplicado}</span>
                      ) : (
                        <span className="badge badge-neutral">Ninguna</span>
                      )}
                    </td>
                    <td className="num">{formatCRC(oc.ahorro)}</td>
                    <td className="num">
                      <strong>{formatCRC(oc.totalNeto)}</strong>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => onOpenAuditoria(oc.id)}
                        data-testid={`btn-auditoria-oc-${oc.numeroOc}`}
                      >
                        Ver auditoría
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

