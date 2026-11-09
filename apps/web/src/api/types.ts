export type TipoPromocion = 'PORCENTAJE' | 'MONTO_FIJO' | 'ESCALONADO' | 'DOS_POR_UNO';

export type MotivoEvaluacion =
  | 'APLICADA'
  | 'VENCIDA'
  | 'AUN_NO_VIGENTE'
  | 'MONTO_INSUFICIENTE'
  | 'SIN_LINEAS_ELEGIBLES'
  | 'TRAMO_NO_ALCANZADO'
  | 'SIN_AHORRO'
  | 'MENOR_AHORRO'
  | 'DESEMPATE';

export interface Proveedor {
  id: number;
  codigo: string;
  nombre: string;
}

export interface Categoria {
  id: number;
  codigo: string;
  nombre: string;
}

export interface Articulo {
  id: number;
  sku: string;
  nombre: string;
  unidad: string;
  precioSugerido: number;
  categoriaId: number;
  categoriaCodigo: string;
  categoriaNombre: string;
}

export interface CatalogosResponse {
  proveedores: Proveedor[];
  categorias: Categoria[];
  articulos: Articulo[];
}

export interface TramoPromocion {
  id?: number;
  promocionId?: number;
  cantidadMinima: number;
  tasaBps: number;
}

export interface Promocion {
  id: number;
  proveedorId: number;
  proveedorCodigo: string;
  proveedorNombre: string;
  codigo: string;
  nombre: string;
  tipo: TipoPromocion;
  tasaBps: number | null;
  montoFijo: number | null;
  fechaInicio: string;
  fechaFin: string;
  prioridad: number;
  montoMinimo: number;
  categoriaId: number | null;
  categoriaCodigo: string | null;
  categoriaNombre: string | null;
  articuloId: number | null;
  sku: string | null;
  articuloNombre: string | null;
  tramos: TramoPromocion[];
}

export interface CrearPromocionInput {
  proveedorId: number;
  codigo: string;
  nombre: string;
  tipo: TipoPromocion;
  tasaBps?: number | null;
  montoFijo?: number | null;
  fechaInicio: string;
  fechaFin: string;
  prioridad: number;
  montoMinimo: number;
  categoriaId?: number | null;
  articuloId?: number | null;
  tramos?: Array<{ cantidadMinima: number; tasaBps: number }>;
}

export interface LineaOrdenInput {
  articuloId: number;
  cantidad: number;
  precioUnitario: number;
}

export interface CrearOrdenInput {
  numeroOc: string;
  fechaOc: string;
  proveedorId: number;
  lineas: LineaOrdenInput[];
}

export interface LineaOrdenDetalle {
  id: number;
  ordenId: number;
  articuloId: number;
  sku: string;
  articuloNombre: string;
  unidad: string;
  categoriaId: number;
  categoriaCodigo: string;
  categoriaNombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotalLinea: number;
}

export interface EvaluacionAuditoria {
  id?: number;
  ordenId?: number;
  promocionId: number | null;
  codigo: string;
  nombre: string;
  tipo: TipoPromocion;
  elegible: boolean;
  aplicada: boolean;
  ahorroPotencial: number;
  motivo: MotivoEvaluacion;
  explicacion: string;
  configuracion: {
    codigo: string;
    nombre: string;
    tipo: TipoPromocion;
    tasaBps: number | null;
    montoFijo: number | null;
    fechaInicio: string;
    fechaFin: string;
    prioridad: number;
    montoMinimo: number;
    categoriaId: number | null;
    categoriaCodigo: string | null;
    articuloId: number | null;
    sku: string | null;
    tramos: TramoPromocion[];
  };
}

export interface OrdenResumen {
  id: number;
  numeroOc: string;
  proveedorId: number;
  proveedorCodigo: string;
  proveedorNombre: string;
  fechaOc: string;
  subtotal: number;
  promocionAplicadaId: number | null;
  codigoAplicado: string | null;
  ahorro: number;
  totalNeto: number;
  creadoEn: string;
  cantidadLineas?: number;
}

export interface OrdenDetalle extends OrdenResumen {
  lineas: LineaOrdenDetalle[];
  auditoria?: EvaluacionAuditoria[];
}

export interface AuditoriaOrdenResponse {
  ordenId: number;
  numeroOc: string;
  fechaOc: string;
  proveedorId: number;
  proveedorNombre: string;
  subtotal: number;
  codigoAplicado: string | null;
  ahorro: number;
  totalNeto: number;
  evaluaciones: EvaluacionAuditoria[];
}

export interface FilaAhorroProveedor {
  proveedorId: number;
  proveedorCodigo: string;
  proveedorNombre: string;
  mes: string;
  cantidadOrdenes: number;
  subtotalTotal: number;
  ahorroTotal: number;
  totalNeto: number;
}

export interface ReporteAhorrosResponse {
  mes: string | null;
  totalAhorro: number;
  items: FilaAhorroProveedor[];
}

export interface ReportePromocionesSinUsoResponse {
  fecha: string;
  items: Promocion[];
}

