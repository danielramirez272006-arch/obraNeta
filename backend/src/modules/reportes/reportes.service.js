import { ValidationError } from '../../http/errors.js';
import { isValidCalendarDate, isValidYearMonth } from '../../http/validators.js';

export class ReportesService {
  /**
   * @param {import('./reportes.repository.js').ReportesRepository} repo
   */
  constructor(repo) {
    this.repo = repo;
  }

  consultarAhorros({ mes } = {}) {
    if (mes !== undefined && mes !== null && mes !== '') {
      if (!isValidYearMonth(mes)) {
        throw new ValidationError('El parámetro "mes" debe tener el formato YYYY-MM válido.', {
          mes: 'Use el formato YYYY-MM (por ejemplo, 2026-10).'
        });
      }
      const items = this.repo.obtenerAhorrosPorProveedor({ mes });
      const totalAhorro = items.reduce((acc, row) => acc + row.ahorroTotal, 0);
      return {
        mes,
        totalAhorro,
        items
      };
    }

    const items = this.repo.obtenerAhorrosPorProveedor();
    const totalAhorro = items.reduce((acc, row) => acc + row.ahorroTotal, 0);
    return {
      mes: null,
      totalAhorro,
      items
    };
  }

  consultarPromocionesSinUso({ fecha } = {}) {
    if (!isValidCalendarDate(fecha)) {
      throw new ValidationError(
        'El parámetro "fecha" debe ser una fecha calendario válida en formato YYYY-MM-DD.',
        {
          fecha: 'Ingrese una fecha válida YYYY-MM-DD (por ejemplo, 2026-10-15).'
        }
      );
    }

    const items = this.repo.obtenerPromocionesVigentesSinUso({ fecha });
    return {
      fecha,
      items
    };
  }
}
