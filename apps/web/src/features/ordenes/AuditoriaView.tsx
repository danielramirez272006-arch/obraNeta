import React, { useEffect, useState } from 'react';
import { apiClient, ApiClientError } from '../../api/client';
import type { AuditoriaOrdenResponse, OrdenDetalle, OrdenResumen } from '../../api/types';
import { AlertBanner } from '../../components/AlertBanner';
import { EmptyState } from '../../components/EmptyState';
import {
  etiquetaMotivoEvaluacion,
  etiquetaTipoPromocion,
  formatCRC
} from '../../components/formatters';

interface AuditoriaViewProps {
  ordenes: OrdenResumen[];
  selectedOrdenId: number | null;
  onSelectOrdenId: (id: number) => void;
}

export const AuditoriaView: React.FC<AuditoriaViewProps> = ({
  ordenes,
  selectedOrdenId,
  onSelectOrdenId
}) => {
  const [auditoria, setAuditoria] = useState<AuditoriaOrdenResponse | null>(null);
  const [detalleOrden, setDetalleOrden] = useState<OrdenDetalle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveOrdenId = selectedOrdenId ?? (ordenes.length > 0 ? ordenes[0].id : null);

  useEffect(() => {
    if (!effectiveOrdenId) {
      setAuditoria(null);
      setDetalleOrden(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      apiClient.obtenerAuditoriaOrden(effectiveOrdenId),
      apiClient.obtenerOrden(effectiveOrdenId)
    ])
      .then(([audData, ordData]) => {
        if (!active) return;
        setAuditoria(audData);
        setDetalleOrden(ordData);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof ApiClientError
            ? err.message
            : 'No se pudo cargar la auditoría de la orden.'
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [effectiveOrdenId]);

  if (ordenes.length === 0) {
    return (
      <section className="panel" aria-labelledby="titulo-auditoria">
        <div className="panel-header">
          <h2 id="titulo-auditoria">Auditoría de Promociones por Orden</h2>
          <p className="panel-subtitle">
            Consulte el detalle histórico de cada promoción evaluada, su ahorro potencial y el motivo de aplicación o descarte.
          </p>
        </div>
        <EmptyState
          title="Aún no hay órdenes de compra registradas"
          description="Registre una orden en la pestaña «Órdenes» (por ejemplo, con el botón «Cargar ejemplo de cemento») para inspeccionar su auditoría."
        />
      </section>
    );
  }

  const descartadasCount =
    auditoria?.evaluaciones.filter((ev) => !ev.aplicada).length ?? 0;

  return (
    <section className="panel" aria-labelledby="titulo-auditoria">
      <div className="panel-header">
        <div>
          <h2 id="titulo-auditoria">Auditoría de la Orden de Compra</h2>
          <p className="panel-subtitle">
            Registro inmutable de las promociones evaluadas al momento de guardar la orden.
          </p>
        </div>

        <div className="form-group inline-selector">
          <label htmlFor="select-orden-auditoria">Orden a consultar</label>
          <select
            id="select-orden-auditoria"
            value={effectiveOrdenId ?? ''}
            onChange={(e) => onSelectOrdenId(Number(e.target.value))}
          >
            {ordenes.map((oc) => (
              <option key={oc.id} value={oc.id}>
                {oc.numeroOc} — {oc.proveedorNombre} ({oc.fechaOc}) — Total {formatCRC(oc.totalNeto)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <AlertBanner variant="error" title="Error" message={error} />}

      {loading && (
        <p className="loading-state" role="status">
          Cargando auditoría de la orden...
        </p>
      )}

      {!loading && auditoria && (
        <>
          <div className="summary-grid" data-testid="auditoria-resumen">
            <div className="summary-card">
              <span className="summary-label">Número de OC</span>
              <strong className="summary-value">{auditoria.numeroOc}</strong>
              <span className="summary-meta">
                {auditoria.proveedorNombre} · Fecha: {auditoria.fechaOc}
              </span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Subtotal antes de descuento</span>
              <strong className="summary-value">{formatCRC(auditoria.subtotal)}</strong>
              <span className="summary-meta">
                {auditoria.evaluaciones.length} promociones evaluadas ({descartadasCount} descartes)
              </span>
            </div>
            <div className="summary-card highlight-success">
              <span className="summary-label">Promoción aplicada y ahorro</span>
              <strong className="summary-value">
                {auditoria.codigoAplicado ?? 'Ninguna'} ({formatCRC(auditoria.ahorro)})
              </strong>
              <span className="summary-meta">Beneficio confirmado por el motor</span>
            </div>
            <div className="summary-card highlight-primary">
              <span className="summary-label">Total neto a pagar</span>
              <strong className="summary-value">{formatCRC(auditoria.totalNeto)}</strong>
              <span className="summary-meta">Subtotal menos ahorro aplicado</span>
            </div>
          </div>

          {detalleOrden && detalleOrden.lineas.length > 0 && (
            <div className="subpanel">
              <h3>Líneas de la orden {detalleOrden.numeroOc}</h3>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Artículo</th>
                      <th>Categoría</th>
                      <th className="num">Cantidad</th>
                      <th className="num">Precio unitario</th>
                      <th className="num">Subtotal línea</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalleOrden.lineas.map((linea) => (
                      <tr key={linea.id}>
                        <td>
                          <code>{linea.sku}</code>
                        </td>
                        <td>{linea.articuloNombre}</td>
                        <td>{linea.categoriaNombre}</td>
                        <td className="num">
                          {linea.cantidad} {linea.unidad}
                        </td>
                        <td className="num">{formatCRC(linea.precioUnitario)}</td>
                        <td className="num">
                          <strong>{formatCRC(linea.subtotalLinea)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="subpanel">
            <h3>
              Promociones evaluadas ({auditoria.evaluaciones.length}) — {descartadasCount}{' '}
              {descartadasCount === 1 ? 'descarte' : 'descartes'}
            </h3>

            {auditoria.evaluaciones.length === 0 ? (
              <EmptyState
                title="El proveedor no tenía promociones registradas"
                description="Al momento de guardar esta orden, el proveedor no contaba con promociones configuradas."
              />
            ) : (
              <div className="audit-cards" data-testid="lista-evaluaciones-auditoria">
                {auditoria.evaluaciones.map((ev) => (
                  <article
                    key={ev.codigo}
                    className={`audit-card ${ev.aplicada ? 'audit-card-applied' : 'audit-card-discarded'}`}
                    data-testid={`auditoria-item-${ev.codigo}`}
                  >
                    <div className="audit-card-header">
                      <div>
                        <span
                          className={`badge ${ev.aplicada ? 'badge-success' : ev.elegible ? 'badge-warning' : 'badge-neutral'}`}
                        >
                          {ev.aplicada
                            ? 'APLICADA'
                            : ev.elegible
                              ? 'DESCARTADA (ELEGIBLE)'
                              : 'DESCARTADA (NO ELEGIBLE)'}
                        </span>
                        <h4 className="audit-promo-title">
                          <code>{ev.codigo}</code> — {ev.nombre}
                        </h4>
                      </div>
                      <div className="audit-savings">
                        <span className="audit-savings-label">Ahorro potencial</span>
                        <strong className="audit-savings-amount">
                          {formatCRC(ev.ahorroPotencial)}
                        </strong>
                      </div>
                    </div>

                    <div className="audit-card-body">
                      <p className="audit-motive">
                        <strong>Motivo:</strong>{' '}
                        <span className="motive-code">{etiquetaMotivoEvaluacion(ev.motivo)}</span>
                      </p>
                      <p className="audit-explanation">{ev.explicacion}</p>
                      <div className="audit-config-meta">
                        <span>
                          <strong>Tipo:</strong> {etiquetaTipoPromocion(ev.tipo)}
                        </span>
                        <span>
                          <strong>Vigencia evaluada:</strong> {ev.configuracion.fechaInicio} al{' '}
                          {ev.configuracion.fechaFin}
                        </span>
                        <span>
                          <strong>Prioridad:</strong> {ev.configuracion.prioridad}
                        </span>
                        {ev.configuracion.montoMinimo > 0 && (
                          <span>
                            <strong>Mínimo OC:</strong> {formatCRC(ev.configuracion.montoMinimo)}
                          </span>
                        )}
                        {ev.configuracion.sku && (
                          <span>
                            <strong>Filtro SKU:</strong> <code>{ev.configuracion.sku}</code>
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};

