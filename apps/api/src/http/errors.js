export class AppError extends Error {
  /**
   * @param {string} message
   * @param {object} [options]
   * @param {number} [options.status=400]
   * @param {string} [options.code='APP_ERROR']
   * @param {Record<string, string>} [options.fields={}]
   */
  constructor(message, { status = 400, code = 'APP_ERROR', fields = {} } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Hay errores de validación en los datos enviados.', fields = {}) {
    super(message, { status: 400, code: 'VALIDATION_ERROR', fields });
    this.name = 'ValidationError';
  }
}

export class ConflictError extends AppError {
  constructor(message, fields = {}) {
    super(message, { status: 409, code: 'CONFLICT_ERROR', fields });
    this.name = 'ConflictError';
  }
}

export class NotFoundError extends AppError {
  constructor(message) {
    super(message, { status: 404, code: 'NOT_FOUND', fields: {} });
    this.name = 'NotFoundError';
  }
}

/**
 * Middleware común de manejo de errores HTTP.
 * Devuelve siempre JSON estructurado e incluye `fields` para errores por campo.
 */
export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      code: err.code,
      message: err.message,
      fields: err.fields || {},
      error: {
        code: err.code,
        message: err.message,
        fields: err.fields || {}
      }
    });
  }

  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      code: 'INVALID_JSON',
      message: 'El cuerpo de la petición no es un JSON válido.',
      fields: {},
      error: {
        code: 'INVALID_JSON',
        message: 'El cuerpo de la petición no es un JSON válido.',
        fields: {}
      }
    });
  }

  console.error('Error inesperado en API:', err);
  return res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'Ocurrió un error interno en el servidor.',
    fields: {},
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Ocurrió un error interno en el servidor.',
      fields: {}
    }
  });
}

