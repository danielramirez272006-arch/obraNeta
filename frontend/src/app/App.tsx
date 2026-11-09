import React, { useEffect, useState } from 'react';
import { apiClient, ApiClientError } from '../api/client';
import type {
  Articulo,
  Categoria,
  OrdenDetalle,
  OrdenResumen,
  Proveedor
} from '../api/types';
import { AlertBanner } from '../components/AlertBanner';
import { AuditoriaView } from '../features/ordenes/AuditoriaView';
import { OrdenesScreen } from '../features/ordenes/OrdenesScreen';
import { PromocionesScreen } from '../features/promociones/PromocionesScreen';
import { ReportesScreen } from '../features/reportes/ReportesScreen';

type VistaActiva = 'ordenes' | 'auditoria' | 'promociones' | 'reportes';

export const App: React.FC = () => {
  const [vista, setVista] = useState<VistaActiva>('ordenes');
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenResumen[]>([]);
  const [selectedOrdenId, setSelectedOrdenId] = useState<number | null>(null);

  const [loadingInicial, setLoadingInicial] = useState(true);
  const [errorInicial, setErrorInicial] = useState<string | null>(null);

  const cargarDatosIniciales = async () => {
    setLoadingInicial(true);
    setErrorInicial(null);
    try {
      const [catRes, ordRes] = await Promise.all([
        apiClient.obtenerCatalogos(),
        apiClient.listarOrdenes()
      ]);
      setProveedores(catRes.proveedores);
      setCategorias(catRes.categorias);
      setArticulos(catRes.articulos);
      setOrdenes(ordRes.items);
      if (ordRes.items.length > 0 && selectedOrdenId === null) {
        setSelectedOrdenId(ordRes.items[0].id);
      }
    } catch (err) {
      setErrorInicial(
        err instanceof ApiClientError
          ? err.message
          : 'No se pudo conectar con la API de ObraNeta. Verifique que el servidor esté en ejecución.'
      );
    } finally {
      setLoadingInicial(false);
    }
  };

  useEffect(() => {
    void cargarDatosIniciales();
  }, []);

  const handleOrdenCreated = (nuevaOrden: OrdenDetalle) => {
    setOrdenes((prev) => [nuevaOrden, ...prev.filter((o) => o.id !== nuevaOrden.id)]);
    setSelectedOrdenId(nuevaOrden.id);
  };

  const handleOpenAuditoria = (ordenId: number) => {
    setSelectedOrdenId(ordenId);
    setVista('auditoria');
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <div className="brand-block">
            <span className="brand-badge">Constructora Del Valle S.A.</span>
            <h1 className="brand-title">ObraNeta — Órdenes de Compra y Promociones</h1>
          </div>

          <nav className="main-nav" aria-label="Navegación principal">
            <button
              type="button"
              className={`nav-tab ${vista === 'ordenes' ? 'active' : ''}`}
              onClick={() => setVista('ordenes')}
              aria-current={vista === 'ordenes' ? 'page' : undefined}
              data-testid="tab-ordenes"
            >
              1. Órdenes
            </button>
            <button
              type="button"
              className={`nav-tab ${vista === 'auditoria' ? 'active' : ''}`}
              onClick={() => setVista('auditoria')}
              aria-current={vista === 'auditoria' ? 'page' : undefined}
              data-testid="tab-auditoria"
            >
              2. Auditoría {ordenes.length > 0 ? `(${ordenes.length})` : ''}
            </button>
            <button
              type="button"
              className={`nav-tab ${vista === 'promociones' ? 'active' : ''}`}
              onClick={() => setVista('promociones')}
              aria-current={vista === 'promociones' ? 'page' : undefined}
              data-testid="tab-promociones"
            >
              3. Promociones
            </button>
            <button
              type="button"
              className={`nav-tab ${vista === 'reportes' ? 'active' : ''}`}
              onClick={() => setVista('reportes')}
              aria-current={vista === 'reportes' ? 'page' : undefined}
              data-testid="tab-reportes"
            >
              4. Reportes
            </button>
          </nav>
        </div>
      </header>

      <main className="app-main">
        {errorInicial && (
          <AlertBanner
            variant="error"
            title="Error de conexión"
            message={errorInicial}
          />
        )}

        {loadingInicial ? (
          <div className="panel">
            <p className="loading-state" role="status">
              Cargando catálogos y órdenes de ObraNeta...
            </p>
          </div>
        ) : (
          <>
            {vista === 'ordenes' && (
              <OrdenesScreen
                proveedores={proveedores}
                articulos={articulos}
                ordenes={ordenes}
                onOrdenCreated={handleOrdenCreated}
                onOpenAuditoria={handleOpenAuditoria}
              />
            )}

            {vista === 'auditoria' && (
              <AuditoriaView
                ordenes={ordenes}
                selectedOrdenId={selectedOrdenId}
                onSelectOrdenId={setSelectedOrdenId}
              />
            )}

            {vista === 'promociones' && (
              <PromocionesScreen
                proveedores={proveedores}
                categorias={categorias}
                articulos={articulos}
              />
            )}

            {vista === 'reportes' && <ReportesScreen />}
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>
          ObraNeta · Gestión de Inventarios — Constructora Del Valle S.A. · Moneda: Colones Costarricenses (CRC)
        </p>
      </footer>
    </div>
  );
};

