export class PlatformContextError extends Error {
  constructor(code, message, statusCode = 400, details = {}) {
    super(message);
    this.name = "PlatformContextError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.exposeCode = true;
  }
}

export function platformError(code, message, statusCode = 400, details = {}) {
  return new PlatformContextError(code, message, statusCode, details);
}
