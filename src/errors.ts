import { toJsonObject } from './types';

export interface TinkerErrorData {
  name: string;
  code: string;
  message: string;
  status?: number;
  details?: unknown;
}

export interface TinkerErrorOptions {
  status?: number;
  details?: unknown;
}

export class TinkerError extends Error {
  code: string;
  status: number | null;
  details: unknown;

  constructor(message: string, code = 'TINKER_ERROR', options: TinkerErrorOptions = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = typeof options.status === 'number' ? options.status : null;
    this.details = options.details;
  }

  getError(): TinkerErrorData {
    const error: TinkerErrorData = {
      name: this.name,
      code: this.code,
      message: this.message
    };

    if (this.status !== null) {
      error.status = this.status;
    }

    if (this.details !== undefined) {
      error.details = this.details;
    }

    return error;
  }
}

export class ApiError extends TinkerError {
  httpStatus: number | null;
  errorCode: string | null;
  providerCode: string | null;
  requestId: string | null;
  retryAfter: string | null;
  outcome: string | null;

  constructor(message: string, status?: number, details?: unknown, headers?: { get(name: string): string | null }) {
    super(message, 'API_ERROR', { status, details });
    const error = toJsonObject(toJsonObject(details).error);
    const stringField = (name: string): string | null =>
      typeof error[name] === 'string' ? (error[name] as string) : null;
    this.httpStatus = this.status;
    this.errorCode = stringField('code');
    this.providerCode = stringField('provider_code');
    this.requestId = stringField('request_id') || headers?.get('X-Request-ID') || null;
    this.retryAfter = headers?.get('Retry-After') || null;
    this.outcome = stringField('outcome');
  }
}

export class FeatureNotSupportedError extends ApiError {
  gateway: string | null;
  feature: string | null;
  alternatives: string[];

  constructor(message: string, status?: number, details?: unknown, headers?: { get(name: string): string | null }) {
    super(message, status, details, headers);
    const info = toJsonObject(toJsonObject(toJsonObject(details).error).details);
    this.gateway = typeof info.gateway === 'string' ? info.gateway : null;
    this.feature = typeof info.feature === 'string' ? info.feature : null;
    this.alternatives = Array.isArray(info.alternatives) ? info.alternatives.filter((a): a is string => typeof a === 'string') : [];
  }
}

export function apiError(message: string, status?: number, details?: unknown, headers?: { get(name: string): string | null }): ApiError {
  const error = new ApiError(message, status, details, headers);
  return error.errorCode === 'FEATURE_NOT_SUPPORTED' ? new FeatureNotSupportedError(message, status, details, headers) : error;
}

export class NetworkError extends TinkerError {
  cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message, 'NETWORK_ERROR');
    this.cause = cause;
  }
}

export class InvalidPayloadError extends TinkerError {
  constructor(message: string, details?: unknown) {
    super(message, 'INVALID_PAYLOAD', { details });
  }
}
