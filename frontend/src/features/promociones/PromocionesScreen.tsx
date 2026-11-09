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
  descuentoPct: string;
}

export function parsePorcentajeToBps(val: string): { bps: number | null; error: string | null } {
  const trimmed = val.trim();
  if (!trimmed) {
    return { bps: null, error: 'El porcentaje de descuento es obligatorio.' };
  }

  // Normalizar coma a punto
  const normalized = trimmed.replace(',', '.');

  // Validar formato numérico con máximo 2 decimales
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    if (/^\d+\.\d{3,}$/.test(normalized)) {
      return { bps: null, error: 'Solo se permiten hasta dos decimales sin redondear.' };
    }
    return { bps: null, error: 'Ingrese un porcentaje válido con punto o coma (ej. 5 o 5,25).' };
  }

  const num = Number(normalized);
  if (num <= 0 || num > 100) {
    return { bps: null, error: 'El porcentaje debe ser mayor a 0 y menor o igual a 100.' };
  }

  // Convertir a bps sin pérdida de precisión de coma flotante
  const parts = normalized.split('.');
  const enteros = parseInt(parts[0], 10);
  const decimalesStr = (parts[1] || '').padEnd(2, '0');
  const decimales = parseInt(decimalesStr, 10);
  const bps = enteros * 100 + decimales;

  if (bps < 1 || bps > 10000) {
    return { bps: null, error: 'La tasa calculada debe estar entre 1 y 10000 puntos básicos (0.01% a 100%).' };
  }

  return { bps, error: null };
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
  const [descuentoPct, setDescuentoPct] = useState('5');
  const [montoFijo, setMontoFijo] = useState('25000');
  const [fechaInicio, setFechaInicio] = useState('2026-10-01');
  const [fechaFin, setFechaFin] = useState('2026-10-31');
  const [prioridad, setPrioridad] = useState('5');
  const [montoMinimo, setMontoMinimo] = useState('0');
  const [categoriaId, setCategoriaId] = useState('');
  const [articuloId, setArticuloId] = useState('');
  const [tramos, setTramos] = useState<TramoInputState[]>([
    { cantidadMinima: '50', descuentoPct: '5' },
    { cantidadMinima: '100', descuentoPct: '10' }
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
    setTramos((prev) => [...prev, { cantidadMinima: '', descuentoPct: '' }]);
  };

  const handleEliminarTramo = (idx: number) => {
    if (tramos.length <= 1) return;
    setTramos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCambioTramo = (
    idx: number,
    campo: 'cantidadMinima' | 'descuentoPct',
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

    const erroresLocales: Record<string, string> = {};

    let tasaBpsCalculada: number | null = null;
    if (tipo === 'PORCENTAJE') {
      const parsed = parsePorcentajeToBps(descuentoPct);
      if (parsed.error) {
        erroresLocales.descuentoPct = parsed.error;
        erroresLocales.tasaBps = parsed.error;
      } else {
        tasaBpsCalculada = parsed.bps;
      }
    }

    let tramosCalculados: Array<{ cantidadMinima: number; tasaBps: number }> | undefined = undefined;
    if (tipo === 'ESCALONADO') {
      tramosCalculados = [];
      tramos.forEach((tr, i) => {
        const parsed = parsePorcentajeToBps(tr.descuentoPct);
        if (parsed.error) {
          erroresLocales[`tramos.${i}.descuentoPct`] = `Tramo #${i + 1}: ${parsed.error}`;
          if (!erroresLocales.tramos) {
            erroresLocales.tramos = `Tramo #${i + 1}: ${parsed.error}`;
          }
        } else if (parsed.bps !== null) {
          tramosCalculados!.push({
            cantidadMinima: Number(tr.cantidadMinima),
            tasaBps: parsed.bps
          });
        }
      });
    }

    if (Object.keys(erroresLocales).length > 0) {
      setFieldErrors(erroresLocales);
      setSubmitting(false);
      return;
    }

    try {
      const creada = await apiClient.crearPromocion({
        proveedorId: Number(proveedorId),
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        tipo,
        tasaBps: tasaBpsCalculada,
        montoFijo: tipo === 'MONTO_FIJO' ? Number(montoFijo) : null,
        fechaInicio,
        fechaFin,
        prioridad: Number(prioridad),
        montoMinimo: Number(montoMinimo || 0),
        categoriaId: categoriaId ? Number(categoriaId) : null,
        articuloId: articuloId ? Number(articuloId) : null,
        tramos: tramosCalculados
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
        <div className="panel-header view-title-anim">
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
          {/* 1. Identificación */}
          <div className="form-section-group">
            <h3 className="form-group-title">1. Identificación</h3>
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
          </div>

          {/* 2. Vigencia */}
          <div className="form-section-group">
            <h3 className="form-group-title">2. Vigencia</h3>
            <div className="form-grid-2">
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
          </div>

          {/* 3. Beneficio */}
          <div className="form-section-group">
            <h3 className="form-group-title">3. Beneficio</h3>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
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

            {/* Campos adaptativos según el tipo de beneficio */}
            <div className="adaptive-benefit-box">
              <h3>Configuración del beneficio ({etiquetaTipoPromocion(tipo)})</h3>

              {tipo === 'PORCENTAJE' && (
                <div className="form-group">
                  <label htmlFor="promo-descuento-pct">Descuento (%)</label>
                  <input
                    id="promo-descuento-pct"
                    type="text"
                    inputMode="decimal"
                    placeholder="Ej. 5 o 5,25"
                    value={descuentoPct}
                    onChange={(e) => setDescuentoPct(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.descuentoPct || fieldErrors.tasaBps)}
                  />
                  <span className="field-hint">
                    Acepta hasta 2 decimales con punto o coma (ej. 5 % = 500 bps, 5,25 % = 525 bps).
                  </span>
                  <FormFieldError error={fieldErrors.descuentoPct || fieldErrors.tasaBps} />
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
                      Defina los tramos de cantidad mínima del SKU y su Descuento (%):
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
                          Descuento (%)
                        </label>
                        <input
                          id={`tramo-tasa-${idx}`}
                          type="text"
                          inputMode="decimal"
                          placeholder="Ej. 8 o 12,5"
                          value={tramo.descuentoPct}
                          onChange={(e) => handleCambioTramo(idx, 'descuentoPct', e.target.value)}
                          aria-invalid={Boolean(fieldErrors[`tramos.${idx}.descuentoPct`])}
                        />
                        <FormFieldError error={fieldErrors[`tramos.${idx}.descuentoPct`]} />
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
          </div>

          {/* 4. Condiciones de aplicación */}
          <div className="form-section-group">
            <h3 className="form-group-title">4. Condiciones de aplicación</h3>
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
        <div className="panel-header view-title-anim">
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

