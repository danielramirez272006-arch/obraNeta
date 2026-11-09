import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { formatCantidadUnidad, formatPorcentajeBps } from '../src/components/formatters';
import { AuditoriaView } from '../src/features/ordenes/AuditoriaView';
import { OrdenesScreen } from '../src/features/ordenes/OrdenesScreen';
import { parsePorcentajeToBps } from '../src/features/promociones/PromocionesScreen';

const mockProveedores = [
  { id: 1, codigo: 'PROV-A', nombre: 'Proveedor A' },
  { id: 2, codigo: 'PROV-B', nombre: 'Proveedor B' }
];

const mockArticulos = [
  {
    id: 1,
    sku: 'CEM-GRIS-50',
    nombre: 'Cemento gris de 50 kg',
    unidad: 'saco',
    precioSugerido: 6300,
    categoriaId: 1,
    categoriaCodigo: 'CEMENTO',
    categoriaNombre: 'Cemento y Morteros'
  }
];

describe('Frontend ObraNeta - Componentes y flujo de aceptación', () => {
  it('Carga el ejemplo de cemento, sugiere correlativo libre y calcula el subtotal preliminar de ₡1 260 000', () => {
    const onOrdenCreated = vi.fn();
    const onOpenAuditoria = vi.fn();

    // Simular que OC-2026-001 ya existe en las órdenes guardadas
    const ordenesExistentes = [
      {
        id: 1,
        numeroOc: 'OC-2026-001',
        proveedorId: 1,
        proveedorCodigo: 'PROV-A',
        proveedorNombre: 'Proveedor A',
        fechaOc: '2026-10-15',
        subtotal: 1260000,
        promocionAplicadaId: 1,
        codigoAplicado: 'CEMENTO5',
        ahorro: 63000,
        totalNeto: 1197000,
        creadoEn: '2026-10-15 10:00:00'
      }
    ];

    render(
      <OrdenesScreen
        proveedores={mockProveedores}
        articulos={mockArticulos}
        ordenes={ordenesExistentes}
        onOrdenCreated={onOrdenCreated}
        onOpenAuditoria={onOpenAuditoria}
      />
    );

    const btnCargar = screen.getByTestId('btn-cargar-ejemplo-cemento');
    fireEvent.click(btnCargar);

    // Debe sugerir OC-2026-002 porque OC-2026-001 ya está ocupada
    const inputNumeroOc = screen.getByLabelText(/Número de OC/i) as HTMLInputElement;
    expect(inputNumeroOc.value).toBe('OC-2026-002');

    const subtotalPreliminar = screen.getByTestId('subtotal-preliminar');
    expect(subtotalPreliminar).toHaveTextContent('₡1 260 000');
  });

  it('Valida la conversión y formato de porcentajes a puntos básicos (bps) y rechaza más de 2 decimales', () => {
    expect(parsePorcentajeToBps('5')).toEqual({ bps: 500, error: null });
    expect(parsePorcentajeToBps('5,25')).toEqual({ bps: 525, error: null });
    expect(parsePorcentajeToBps('5.25')).toEqual({ bps: 525, error: null });
    expect(parsePorcentajeToBps('0.05')).toEqual({ bps: 5, error: null });
    expect(parsePorcentajeToBps('100')).toEqual({ bps: 10000, error: null });

    // Rechaza más de dos decimales sin redondear
    expect(parsePorcentajeToBps('5.255').error).toBe('Solo se permiten hasta dos decimales sin redondear.');
    expect(parsePorcentajeToBps('5,123').error).toBe('Solo se permiten hasta dos decimales sin redondear.');

    // Formato de presentación para el usuario
    expect(formatPorcentajeBps(500)).toBe('5 %');
    expect(formatPorcentajeBps(525)).toBe('5.25 %');
  });

  it('Formatea cantidades con unidades correctas en singular y plural, respetando invariables', () => {
    expect(formatCantidadUnidad(1, 'saco')).toBe('1 saco');
    expect(formatCantidadUnidad(200, 'saco')).toBe('200 sacos');
    expect(formatCantidadUnidad(1, 'varilla')).toBe('1 varilla');
    expect(formatCantidadUnidad(50, 'varilla')).toBe('50 varillas');
    expect(formatCantidadUnidad(1, 'unidad')).toBe('1 unidad');
    expect(formatCantidadUnidad(10, 'unidad')).toBe('10 unidades');

    // Invariables como kg o m³
    expect(formatCantidadUnidad(50, 'kg')).toBe('50 kg');
    expect(formatCantidadUnidad(1, 'kg')).toBe('1 kg');
    expect(formatCantidadUnidad(15, 'm³')).toBe('15 m³');
  });

  it('Muestra las tres evaluaciones en la auditoría con la promoción ganadora, los dos descartes y unidades en plural', () => {
    const mockEvaluaciones = [
      {
        codigo: 'CEMENTO5',
        nombre: 'Descuento 5% en Cemento Gris 50 kg',
        tipo: 'PORCENTAJE' as const,
        elegible: true,
        aplicada: true,
        ahorroPotencial: 63000,
        motivo: 'APLICADA' as const,
        explicacion: 'Promoción aplicada por generar el mayor ahorro (₡63 000).',
        configuracion: {
          codigo: 'CEMENTO5',
          nombre: 'Descuento 5%',
          tipo: 'PORCENTAJE' as const,
          tasaBps: 500,
          montoFijo: null,
          fechaInicio: '2026-10-01',
          fechaFin: '2026-10-31',
          prioridad: 10,
          montoMinimo: 0,
          categoriaId: null,
          categoriaCodigo: null,
          articuloId: 1,
          sku: 'CEM-GRIS-50',
          tramos: []
        }
      },
      {
        codigo: 'FIJO50000',
        nombre: 'Bono fijo de ₡50 000',
        tipo: 'MONTO_FIJO' as const,
        elegible: true,
        aplicada: false,
        ahorroPotencial: 50000,
        motivo: 'MENOR_AHORRO' as const,
        explicacion: 'Elegible con ahorro potencial de ₡50 000, pero descartada frente a CEMENTO5.',
        configuracion: {
          codigo: 'FIJO50000',
          nombre: 'Bono fijo',
          tipo: 'MONTO_FIJO' as const,
          tasaBps: null,
          montoFijo: 50000,
          fechaInicio: '2026-10-01',
          fechaFin: '2026-10-31',
          prioridad: 5,
          montoMinimo: 1000000,
          categoriaId: null,
          categoriaCodigo: null,
          articuloId: null,
          sku: null,
          tramos: []
        }
      },
      {
        codigo: 'CEMENTO10',
        nombre: 'Promoción Septiembre 10%',
        tipo: 'PORCENTAJE' as const,
        elegible: false,
        aplicada: false,
        ahorroPotencial: 0,
        motivo: 'VENCIDA' as const,
        explicacion: 'La promoción venció el 2026-09-30 y la orden tiene fecha 2026-10-15.',
        configuracion: {
          codigo: 'CEMENTO10',
          nombre: 'Septiembre 10%',
          tipo: 'PORCENTAJE' as const,
          tasaBps: 1000,
          montoFijo: null,
          fechaInicio: '2026-09-01',
          fechaFin: '2026-09-30',
          prioridad: 10,
          montoMinimo: 0,
          categoriaId: null,
          categoriaCodigo: null,
          articuloId: 1,
          sku: 'CEM-GRIS-50',
          tramos: []
        }
      }
    ];

    // Mock fetch de auditoría y detalle de orden
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auditoria')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              ordenId: 1,
              numeroOc: 'OC-DEMO-001',
              fechaOc: '2026-10-15',
              proveedorId: 1,
              proveedorNombre: 'Proveedor A',
              subtotal: 1260000,
              codigoAplicado: 'CEMENTO5',
              ahorro: 63000,
              totalNeto: 1197000,
              evaluaciones: mockEvaluaciones
            })
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            id: 1,
            numeroOc: 'OC-DEMO-001',
            fechaOc: '2026-10-15',
            proveedorId: 1,
            proveedorNombre: 'Proveedor A',
            subtotal: 1260000,
            codigoAplicado: 'CEMENTO5',
            ahorro: 63000,
            totalNeto: 1197000,
            lineas: [
              {
                id: 1,
                ordenId: 1,
                articuloId: 1,
                sku: 'CEM-GRIS-50',
                articuloNombre: 'Cemento gris de 50 kg',
                unidad: 'saco',
                categoriaId: 1,
                categoriaCodigo: 'CEMENTO',
                categoriaNombre: 'Cemento y Morteros',
                cantidad: 200,
                precioUnitario: 6300,
                subtotalLinea: 1260000
              }
            ]
          })
      });
    }) as any;

    const mockOrdenes = [
      {
        id: 1,
        numeroOc: 'OC-DEMO-001',
        proveedorId: 1,
        proveedorCodigo: 'PROV-A',
        proveedorNombre: 'Proveedor A',
        fechaOc: '2026-10-15',
        subtotal: 1260000,
        promocionAplicadaId: 1,
        codigoAplicado: 'CEMENTO5',
        ahorro: 63000,
        totalNeto: 1197000,
        creadoEn: '2026-10-15 10:00:00'
      }
    ];

    render(
      <AuditoriaView
        ordenes={mockOrdenes}
        selectedOrdenId={1}
        onSelectOrdenId={vi.fn()}
      />
    );

    return screen.findByTestId('auditoria-item-CEMENTO5').then((itemC5) => {
      expect(itemC5).toHaveTextContent('CEMENTO5');
      expect(itemC5).toHaveTextContent('₡63 000');
      expect(itemC5).toHaveTextContent('APLICADA');

      const itemFijo = screen.getByTestId('auditoria-item-FIJO50000');
      expect(itemFijo).toHaveTextContent('FIJO50000');
      expect(itemFijo).toHaveTextContent('₡50 000');
      expect(itemFijo).toHaveTextContent('MENOR_AHORRO');

      const itemC10 = screen.getByTestId('auditoria-item-CEMENTO10');
      expect(itemC10).toHaveTextContent('CEMENTO10');
      expect(itemC10).toHaveTextContent('VENCIDA');

      // Verificar que muestra "200 sacos" en la tabla de líneas
      expect(screen.getByText('200 sacos')).toBeInTheDocument();
    });
  });
});
