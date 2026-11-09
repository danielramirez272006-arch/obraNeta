import React, { useEffect, useState } from 'react';
import { apiClient, ApiClientError } from '../../api/client';
import type {
  Articulo,
  Categoria,
  Promocion,
  Proveedor,
  TipoPromocion
} from '../../api/types';
import { AlertBanner } from '../../components/AlertBanner';
import { EmptyState } from '../../components/EmptyState';
import { FormFieldError } from '../../components/FormFieldError';
import {
  describirBeneficioPromocion,
  etiquetaTipoPromocion,
  formatCRC
} from '../../components/formatters';

interface TramoInputState {
  cantidadMinima: string;
  tasaBps: string;
}

interface PromocionesScreenProps {
  proveedores: Proveedor[];
  categorias: Categoria[];
  articulos: Articulo[];
}

export const PromocionesScreen: React.FC<PromocionesScreenProps> = ({
  proveedores,
  categorias,
  articulos
}) => {
  const [filtroProveedorId, setFiltroProveedorId] = useState<string>('');
  const [promociones, setPromociones] = useState<Promocion[]>([]);
  const [loading, setLoading] = useState(false);

  // Estado del formulario de creación
  const [proveedorId, setProveedorId] = useState<string>(
    proveedores[0]?.id ? String(proveedores[0].id) : ''
  );
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<TipoPromocion>('PORCENTAJE');
  const [tasaBps, setTasaBps] = useState('500');
  const [montoFijo, setMontoFijo] = useState('25000');
  const [fechaInicio, setFechaInicio] = useState('2026-10-01');
  const [fechaFin, setFechaFin] = useState('2026-10-31');
  const [prioridad, setPrioridad] = useState('5');
  const [montoMinimo, setMontoMinimo] = useState('0');
  const [categoriaId, setCategoriaId] = useState('');
  const [articuloId, setArticuloId] = useState('');
  const [tramos, setTramos] = useState<TramoInputState[]>([
    { cantidadMinima: '50', tasaBps: '500' },
    { cantidadMinima: '100', tasaBps: '1000' }
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const cargarPromociones = async (provFiltro?: string) => {
    setLoading(true);
    try {
      const parsedId = provFiltro ? Number(provFiltro) : null;
      const res = await apiClient.listarPromociones(parsedId);
      setPromociones(res.items);
    } catch (err) {
      setBannerError(
        err instanceof ApiClientError ? err.message : 'Error al cargar las promociones.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargarPromociones(filtroProveedorId);
  }, [filtroProveedorId]);

  const handleAgregarTramo = () => {
    setTramos((prev) => [...prev, { cantidadMinima: '', tasaBps: '' }]);
  };

  const handleEliminarTramo = (idx: number) => {
    if (tramos.length <= 1) return;
    setTramos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCambioTramo = (
    idx: number,
    campo: 'cantidadMinima' | 'tasaBps',
    valor: string
  ) => {
    setTramos((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [campo]: valor } : item))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setFieldErrors({});
    setBannerError(null);
    setSuccessMsg(null);

    try {
      const creada = await apiClient.crearPromocion({
        proveedorId: Number(proveedorId),
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        tipo,
        tasaBps: tipo === 'PORCENTAJE' ? Number(tasaBps) : null,
        montoFijo: tipo === 'MONTO_FIJO' ? Number(montoFijo) : null,
        fechaInicio,
        fechaFin,
        prioridad: Number(prioridad),
        montoMinimo: Number(montoMinimo || 0),
        categoriaId: categoriaId ? Number(categoriaId) : null,
        articuloId: articuloId ? Number(articuloId) : null,
        tramos:
          tipo === 'ESCALONADO'
            ? tramos.map((t) => ({
                cantidadMinima: Number(t.cantidadMinima),
                tasaBps: Number(t.tasaBps)
              }))
            : undefined
      });

      setSuccessMsg(`Promoción "${creada.codigo}" creada correctamente.`);
      setCodigo('');
      setNombre('');
      await cargarPromociones(filtroProveedorId);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setBannerError(err.message);
        setFieldErrors(err.fields);
      } else {
        setBannerError('Error inesperado al guardar la promoción.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const requiereSku = tipo === 'ESCALONADO' || tipo === 'DOS_POR_UNO';

  return (
    <div className="screen-stack">
      <section className="panel" aria-labelledby="titulo-crear-promocion">
        <div className="panel-header">
          <div>
            <h2 id="titulo-crear-promocion">Crear Nueva Promoción</h2>
            <p className="panel-subtitle">
              Configure cualquiera de los cuatro tipos de beneficio. Los campos se adaptan automáticamente al tipo elegido.
            </p>
          </div>
        </div>

        {successMsg && (
          <AlertBanner
            variant="success"
            title="Promoción guardada"
            message={successMsg}
            onClose={() => setSuccessMsg(null)}
          />
        )}

        {bannerError && (
          <AlertBanner
            variant="error"
            title="Revisión requerida"
            message={bannerError}
            onClose={() => setBannerError(null)}
          />
        )}

        <form onSubmit={handleSubmit} noValidate className="promo-form">
          <div className="form-grid-3">
            <div className="form-group">
              <label htmlFor="promo-proveedor">Proveedor</label>
              <select
                id="promo-proveedor"
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
                aria-invalid={Boolean(fieldErrors.proveedorId)}
              >
                <option value="">Seleccione proveedor...</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({p.codigo})
                  </option>
                ))}
              </select>
              <FormFieldError error={fieldErrors.proveedorId} />
            </div>

            <div className="form-group">
              <label htmlFor="promo-codigo">Código de promoción</label>
              <input
                id="promo-codigo"
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="Ej. CEMENTO5"
                aria-invalid={Boolean(fieldErrors.codigo)}
              />
              <FormFieldError error={fieldErrors.codigo} />
            </div>

            <div className="form-group">
              <label htmlFor="promo-nombre">Nombre descriptivo</label>
              <input
                id="promo-nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Descuento 5% en Cemento Gris"
                aria-invalid={Boolean(fieldErrors.nombre)}
              />
              <FormFieldError error={fieldErrors.nombre} />
            </div>
          </div>

          <div className="form-grid-3">
            <div className="form-group">
              <label htmlFor="promo-tipo">Tipo de promoción</label>
              <select
                id="promo-tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoPromocion)}
                aria-invalid={Boolean(fieldErrors.tipo)}
              >
                <option value="PORCENTAJE">1. PORCENTAJE (Tasa porcentual)</option>
                <option value="MONTO_FIJO">2. MONTO_FIJO (Descuento fijo en CRC)</option>
                <option value="ESCALONADO">3. ESCALONADO (Tramos por volumen de SKU)</option>
                <option value="DOS_POR_UNO">4. DOS_POR_UNO (2×1 por cada par de SKU)</option>
              </select>
              <FormFieldError error={fieldErrors.tipo} />
            </div>

            <div className="form-group">
              <label htmlFor="promo-fecha-inicio">Fecha de inicio (inclusiva)</label>
              <input
                id="promo-fecha-inicio"
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                aria-invalid={Boolean(fieldErrors.fechaInicio)}
              />
              <FormFieldError error={fieldErrors.fechaInicio} />
            </div>

            <div className="form-group">
              <label htmlFor="promo-fecha-fin">Fecha de fin (inclusiva)</label>
              <input
                id="promo-fecha-fin"
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                aria-invalid={Boolean(fieldErrors.fechaFin)}
              />
              <FormFieldError error={fieldErrors.fechaFin} />
            </div>
          </div>

          {/* Campos adaptativos según el tipo de beneficio */}
          <div className="adaptive-benefit-box">
            <h3>Configuración del beneficio ({etiquetaTipoPromocion(tipo)})</h3>

            {tipo === 'PORCENTAJE' && (
              <div className="form-group">
                <label htmlFor="promo-tasa-bps">
                  Tasa de descuento en puntos básicos (100 bps = 1%, 500 bps = 5%)
                </label>
                <input
                  id="promo-tasa-bps"
                  type="number"
                  min={1}
                  max={10000}
                  value={tasaBps}
                  onChange={(e) => setTasaBps(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.tasaBps)}
                />
                <span className="field-hint">
                  Equivale a: {Number(tasaBps) > 0 ? `${(Number(tasaBps) / 100).toFixed(2)}%` : '0%'}
                </span>
                <FormFieldError error={fieldErrors.tasaBps} />
              </div>
            )}

            {tipo === 'MONTO_FIJO' && (
              <div className="form-group">
                <label htmlFor="promo-monto-fijo">Monto fijo de descuento (CRC enteros)</label>
                <input
                  id="promo-monto-fijo"
                  type="number"
                  min={1}
                  value={montoFijo}
                  onChange={(e) => setMontoFijo(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.montoFijo)}
                />
                <span className="field-hint">
                  Vista previa: {formatCRC(Number(montoFijo) || 0)}
                </span>
                <FormFieldError error={fieldErrors.montoFijo} />
              </div>
            )}

            {tipo === 'ESCALONADO' && (
              <div className="tramos-editor">
                <div className="lines-header">
                  <span>
                    Defina los tramos de cantidad mínima del SKU y su tasa en puntos básicos:
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={handleAgregarTramo}
                  >
                    + Agregar tramo
                  </button>
                </div>

                <FormFieldError error={fieldErrors.tramos} />

                {tramos.map((tramo, idx) => (
                  <div className="tramo-row" key={idx}>
                    <div className="form-group">
                      <label htmlFor={`tramo-cant-${idx}`}>
                        Cantidad mínima (Tramo #{idx + 1})
                      </label>
                      <input
                        id={`tramo-cant-${idx}`}
                        type="number"
                        min={1}
                        value={tramo.cantidadMinima}
                        onChange={(e) =>
                          handleCambioTramo(idx, 'cantidadMinima', e.target.value)
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor={`tramo-tasa-${idx}`}>
                        Tasa en puntos básicos (bps)
                      </label>
                      <input
                        id={`tramo-tasa-${idx}`}
                        type="number"
                        min={1}
                        max={10000}
                        value={tramo.tasaBps}
                        onChange={(e) => handleCambioTramo(idx, 'tasaBps', e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-danger-outline btn-sm"
                      onClick={() => handleEliminarTramo(idx)}
                      disabled={tramos.length <= 1}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}

            {tipo === 'DOS_POR_UNO' && (
              <p className="field-hint">
                En <strong>DOS_POR_UNO (2×1)</strong>, por cada par de unidades elegibles del SKU seleccionado, 1 unidad es gratuita (tomando las unidades de menor precio unitario).
              </p>
            )}
          </div>

          <div className="form-grid-4">
            <div className="form-group">
              <label htmlFor="promo-articulo">
                Artículo / SKU {requiereSku ? '(Obligatorio para este tipo)' : '(Opcional)'}
              </label>
              <select
                id="promo-articulo"
                value={articuloId}
                onChange={(e) => setArticuloId(e.target.value)}
                aria-invalid={Boolean(fieldErrors.articuloId || fieldErrors.sku)}
              >
                <option value="">
                  {requiereSku ? 'Seleccione un SKU obligatorio...' : 'Todos los artículos'}
                </option>
                {articulos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.sku} — {a.nombre}
                  </option>
                ))}
              </select>
              <FormFieldError error={fieldErrors.articuloId || fieldErrors.sku} />
            </div>

            <div className="form-group">
              <label htmlFor="promo-categoria">Categoría (Opcional)</label>
              <select
                id="promo-categoria"
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                aria-invalid={Boolean(fieldErrors.categoriaId)}
              >
                <option value="">Todas las categorías</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.codigo})
                  </option>
                ))}
              </select>
              <FormFieldError error={fieldErrors.categoriaId} />
            </div>

            <div className="form-group">
              <label htmlFor="promo-monto-minimo">Subtotal mínimo de OC (CRC)</label>
              <input
                id="promo-monto-minimo"
                type="number"
                min={0}
                value={montoMinimo}
                onChange={(e) => setMontoMinimo(e.target.value)}
                aria-invalid={Boolean(fieldErrors.montoMinimo)}
              />
              <FormFieldError error={fieldErrors.montoMinimo} />
            </div>

            <div className="form-group">
              <label htmlFor="promo-prioridad">Prioridad (desempate)</label>
              <input
                id="promo-prioridad"
                type="number"
                min={1}
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value)}
                aria-invalid={Boolean(fieldErrors.prioridad)}
              />
              <FormFieldError error={fieldErrors.prioridad} />
            </div>
          </div>

          <div className="form-footer">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              data-testid="btn-crear-promocion"
            >
              {submitting ? 'Guardando promoción...' : 'Guardar promoción'}
            </button>
          </div>
        </form>
      </section>

      <section className="panel" aria-labelledby="titulo-lista-promociones">
        <div className="panel-header">
          <div>
            <h2 id="titulo-lista-promociones">Promociones Registradas por Proveedor</h2>
            <p className="panel-subtitle">
              Consulte las reglas vigentes e históricas configuradas en el catálogo.
            </p>
          </div>

          <div className="form-group inline-selector">
            <label htmlFor="filtro-proveedor-promos">Filtrar por proveedor</label>
            <select
              id="filtro-proveedor-promos"
              value={filtroProveedorId}
              onChange={(e) => setFiltroProveedorId(e.target.value)}
            >
              <option value="">Todos los proveedores</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.codigo})
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="loading-state" role="status">
            Cargando promociones...
          </p>
        ) : promociones.length === 0 ? (
          <EmptyState
            title="No hay promociones para este filtro"
            description="Cree una promoción con el formulario superior o cambie el proveedor seleccionado."
          />
        ) : (
          <div className="table-responsive">
            <table className="data-table" data-testid="tabla-promociones">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Proveedor</th>
                  <th>Tipo</th>
                  <th>Beneficio</th>
                  <th>Vigencia</th>
                  <th>Filtros (Mínimo / Categoría / SKU)</th>
                  <th className="num">Prioridad</th>
                </tr>
              </thead>
              <tbody>
                {promociones.map((promo) => (
                  <tr key={promo.id}>
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
                      <div>Mínimo OC: {formatCRC(promo.montoMinimo)}</div>
                      {promo.categoriaNombre && <div>Categoría: {promo.categoriaNombre}</div>}
                      {promo.sku && (
                        <div>
                          SKU: <code>{promo.sku}</code>
                        </div>
                      )}
                    </td>
                    <td className="num">{promo.prioridad}</td>
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

