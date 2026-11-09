import type {
  AuditoriaOrdenResponse,
  CatalogosResponse,
  CrearOrdenInput,
  CrearPromocionInput,
  OrdenDetalle,
  OrdenResumen,
  Promocion,
  ReporteAhorrosResponse,
  ReportePromocionesSinUsoResponse
} from './types';

export class ApiClientError extends Error {
  status: number;
  code: string;
  fields: Record<string, string>;

  constructor(
    message: string,
    options: { status?: number; code?: string; fields?: Record<string, string> } = {}
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = options.status ?? 400;
    this.code = options.code ?? 'API_ERROR';
    this.fields = options.fields ?? {};
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errObj = (data ?? {}) as {
      code?: string;
      message?: string;
      fields?: Record<string, string>;
      error?: { code?: string; message?: string; fields?: Record<string, string> };
    };
    const message =
      errObj.message ||
      errObj.error?.message ||
      `Error HTTP ${response.status} al comunicarse con el servidor.`;
    const code = errObj.code || errObj.error?.code || 'HTTP_ERROR';
    const fields = errObj.fields || errObj.error?.fields || {};
    throw new ApiClientError(message, { status: response.status, code, fields });
  }

  return data as T;
}

export const apiClient = {
  obtenerCatalogos(): Promise<CatalogosResponse> {
    return requestJson<CatalogosResponse>('/catalogos');
  },

  listarOrdenes(): Promise<{ items: OrdenResumen[] }> {
    return requestJson<{ items: OrdenResumen[] }>('/ordenes');
  },

  obtenerOrden(id: number): Promise<OrdenDetalle> {
    return requestJson<OrdenDetalle>(`/ordenes/${id}`);
  },

  obtenerAuditoriaOrden(id: number): Promise<AuditoriaOrdenResponse> {
    return requestJson<AuditoriaOrdenResponse>(`/ordenes/${id}/auditoria`);
  },

  crearOrden(payload: CrearOrdenInput): Promise<OrdenDetalle> {
    return requestJson<OrdenDetalle>('/ordenes', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  listarPromociones(proveedorId?: number | null): Promise<{ items: Promocion[] }> {
    const query =
      proveedorId !== undefined && proveedorId !== null ? `?proveedorId=${proveedorId}` : '';
    return requestJson<{ items: Promocion[] }>(`/promociones${query}`);
  },

  crearPromocion(payload: CrearPromocionInput): Promise<Promocion> {
    return requestJson<Promocion>('/promociones', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  consultarReporteAhorros(mes: string): Promise<ReporteAhorrosResponse> {
    const query = mes ? `?mes=${encodeURIComponent(mes)}` : '';
    return requestJson<ReporteAhorrosResponse>(`/reportes/ahorros${query}`);
  },

  consultarPromocionesSinUso(fecha: string): Promise<ReportePromocionesSinUsoResponse> {
    return requestJson<ReportePromocionesSinUsoResponse>(
      `/reportes/promociones-sin-uso?fecha=${encodeURIComponent(fecha)}`
    );
  }
};

