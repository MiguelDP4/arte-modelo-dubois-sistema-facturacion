export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    statusCode: number,
    message: string,
    code = 'APP_ERROR',
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function unauthorized(message = 'No autorizado. Inicia sesión para continuar.') {
  return new AppError(401, message, 'UNAUTHORIZED');
}

export function forbidden(message = 'No tienes permisos para realizar esta acción.') {
  return new AppError(403, message, 'FORBIDDEN');
}

export function badRequest(message: string, details?: unknown) {
  return new AppError(400, message, 'BAD_REQUEST', details);
}

export function notFound(message = 'Recurso no encontrado.') {
  return new AppError(404, message, 'NOT_FOUND');
}

export function conflict(message: string) {
  return new AppError(409, message, 'CONFLICT');
}
