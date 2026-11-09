import React, { useEffect, useState } from 'react';
import { apiClient, ApiClientError } from '../../api/client';
import type {
  FilaAhorroProveedor,
  Promocion
} from '../../api/types';
import { AlertBanner } from '../../components/AlertBanner';
import { EmptyState } from '../../components/EmptyState';
import {
  describirBeneficioPromocion,
  formatCRC
} from '../../components/formatters';

export const ReportesScreen: React.FC = () => {
  const [mesAhorro, setMesAhorro] = useState('2026-10');
  const [ahorros, setAhorros] = useState<FilaAhorroProveedor[]>([]);
  const [totalAhorroMes, setTotalAhorroMes] = useState(0);
  const [loadingAhorros, setLoadingAhorros] = useState(false);
  const [errorAhorros, setErrorAhorros] = useState<string | null>(null);

  const [fechaSinUso, setFechaSinUso] = useState('2026-10-15');
  const [promosSinUso, setPromosSinUso] = useState<Promocion[]>([]);
  const [loadingSinUso, setLoadingSinUso] = useState(false);
  const [errorSinUso, setErrorSinUso] = useState<string | null>(null);

  const cargarReporteAhorros = async (mes: string) => {
    setLoadingAhorros(true);
    setErrorAhorros(null);
    try {
      const res = await apiClient.consultarReporteAhorros(mes);
      setAhorros(res.items);
      setTotalAhorroMes(res.totalAhorro);
    } catch (err) {
      setErrorAhorros(
        err instanceof ApiClientError
          ? err.message
          : 'No se pudo consultar el reporte de ahorros.'
      );
    } finally {
      setLoadingAhorros(false);
    }
  };

  const cargarReporteSinUso = async (fecha: string) => {
    setLoadingSinUso(true);
    setErrorSinUso(null);
    try {
      const res = await apiClient.consultarPromocionesSinUso(fecha);
      setPromosSinUso(res.items);
    } catch (err) {
      setErrorSinUso(
        err instanceof ApiClientError
          ? err.message
          : 'No se pudo consultar el reporte de promociones sin uso.'
      );
    } finally {
      setLoadingSinUso(false);
    }
  };

  useEffect(() => {
    void cargarReporteAhorros(mesAhorro);
    void cargarReporteSinUso(fechaSinUso);
  }, []);

  return (
    <div className="screen-stack">
      <section className="panel" aria-labelledby="titulo-reporte-ahorros">
        <div className="panel-header view-title-anim">
          <div>
            <h2 id="titulo-reporte-ahorros">1. Ahorro Aplicado por Proveedor y Mes</h2>
            <p className="panel-subtitle">
              Agrupa el ahorro confirmado en las órdenes de compra según el mes de la OC.
            </p>
          </div>

          <form
            className="inline-filter-form"
            onSubmit={(e) => {
              e.preventDefault();
              void cargarReporteAhorros(mesAhorro);
            }}
          >
            <div className="form-group">
              <label htmlFor="input-mes-reporte">Mes de consulta (YYYY-MM)</label>
              <input
                id="input-mes-reporte"
                type="month"
                value={mesAhorro}
                onChange={(e) => setMesAhorro(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              data-testid="btn-consultar-ahorros"
            >
              Consultar mes
            </button>
          </form>
        </div>

        {errorAhorros && (
          <AlertBanner variant="error" title="Error" message={errorAhorros} />
        )}

        {loadingAhorros ? (
          <p className="loading-state" role="status">
            Calculando ahorros por proveedor...
          </p>
        ) : ahorros.length === 0 ? (
          <EmptyState
            title={`Sin órdenes registradas en el período ${mesAhorro || 'seleccionado'}`}
            description="Cuando registre órdenes de compra en ese mes, verá aquí el ahorro consolidado por proveedor."
          />
        ) : (
          <div className="fade-in-report" key={mesAhorro}>
            <div className="summary-banner" data-testid="resumen-ahorro-mes">
              <span>Ahorro total acumulado en {mesAhorro}:</span>
              <strong>{formatCRC(totalAhorroMes)}</strong>
            </div>

            <div className="table-responsive">
              <table className="data-table" data-testid="tabla-reporte-ahorros">
                <thead>
                  <tr>
                    <th>Proveedor</th>
                    <th>Mes</th>
                    <th className="num">Órdenes (OC)</th>
                    <th className="num">Subtotal bruto</th>
                    <th className="num">Ahorro aplicado</th>
                    <th className="num">Total neto</th>
                  </tr>
                </thead>
                <tbody>
                  {ahorros.map((fila) => (
                    <tr key={`${fila.proveedorId}-${fila.mes}`}>
                      <td>
                        <strong>{fila.proveedorNombre}</strong> ({fila.proveedorCodigo})
                      </td>
                      <td>{fila.mes}</td>
                      <td className="num">{fila.cantidadOrdenes}</td>
                      <td className="num">{formatCRC(fila.subtotalTotal)}</td>
                      <td className="num">
                        <strong className="text-success">{formatCRC(fila.ahorroTotal)}</strong>
                      </td>
                      <td className="num">
                        <strong>{formatCRC(fila.totalNeto)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="titulo-reporte-sin-uso">
        <div className="panel-header view-title-anim">
          <div>
            <h2 id="titulo-reporte-sin-uso">
              2. Promociones Vigentes sin Uso a una Fecha Seleccionada
            </h2>
            <p className="panel-subtitle">
              Lista las promociones cuya vigencia incluye la fecha indicada y que no se habían aplicado a ninguna OC fechada hasta ese día.
            </p>
          </div>

          <form
            className="inline-filter-form"
            onSubmit={(e) => {
              e.preventDefault();
              void cargarReporteSinUso(fechaSinUso);
            }}
          >
            <div className="form-group">
              <label htmlFor="input-fecha-sin-uso">Fecha de corte (YYYY-MM-DD)</label>
              <input
                id="input-fecha-sin-uso"
                type="date"
                value={fechaSinUso}
                onChange={(e) => setFechaSinUso(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              data-testid="btn-consultar-sin-uso"
            >
              Consultar fecha
            </button>
          </form>
        </div>

        {errorSinUso && (
          <AlertBanner variant="error" title="Error" message={errorSinUso} />
        )}

        {loadingSinUso ? (
          <p className="loading-state" role="status">
            Consultando promociones vigentes sin uso...
          </p>
        ) : promosSinUso.length === 0 ? (
          <EmptyState
            title={`No hay promociones vigentes sin uso al ${fechaSinUso}`}
            description="Todas las promociones vigentes en esa fecha ya fueron utilizadas o no existen promociones activas para ese día."
          />
        ) : (
          <div className="fade-in-report" key={fechaSinUso}>
            <div className="table-responsive">
              <table className="data-table" data-testid="tabla-reporte-sin-uso">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Proveedor</th>
                    <th>Tipo</th>
                    <th>Beneficio</th>
                    <th>Vigencia</th>
                    <th>Condiciones</th>
                  </tr>
                </thead>
                <tbody>
                  {promosSinUso.map((promo) => (
                    <tr key={promo.id} data-testid={`sin-uso-row-${promo.codigo}`}>
                      <td>
                        <code>{promo.codigo}</code>
                        <div className="cell-sub">{promo.nombre}</div>
                      </td>
                      <td>{promo.proveedorNombre}</td>
                      <td>
                        <span className="badge badge-neutral">{promo.tipo}</span>
                      </td>
                      <td>{describirBeneficioPromocion(promo)}</td>
                      <td>
                        {promo.fechaInicio} al {promo.fechaFin}
                      </td>
                      <td>
                        Mínimo OC: {formatCRC(promo.montoMinimo)}
                        {promo.sku ? ` · SKU: ${promo.sku}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

