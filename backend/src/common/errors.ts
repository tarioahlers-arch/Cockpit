export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const notFound = (entity: string) => new HttpError(404, `${entity} nicht gefunden`);
export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, details);
export const unauthorized = (message = "Nicht authentifiziert") => new HttpError(401, message);
export const forbidden = (message = "Kein Zugriff") => new HttpError(403, message);
export const conflict = (message: string) => new HttpError(409, message);
