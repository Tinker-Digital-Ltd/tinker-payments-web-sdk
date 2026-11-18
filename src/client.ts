import { ApiError, NetworkError, apiError } from './errors';
import { resolveBaseUrl } from './config';
import {
  errorMessage,
  isJsonObject,
  type ApiEnvelope,
  type CustomerAttributes,
  type CustomerInfo,
  type CustomerOfferings,
  type EntitlementStatus,
  type TinkerClientOptions,
  type TinkerFetch
} from './types';

export default class TinkerClient {
  private readonly publicKey: string;
  private readonly baseUrl: string;
  private readonly getCustomerToken: () => Promise<string>;
  private readonly fetchImpl: TinkerFetch;
  private token: string | null = null;

  constructor(options: TinkerClientOptions) {
    this.publicKey = options.publicKey;
    this.baseUrl = resolveBaseUrl(options.publicKey, options.baseUrl);
    this.getCustomerToken = options.getCustomerToken;
    this.fetchImpl = options.fetch ?? ((url, init) => fetch(url, init));
  }

  getCustomerInfo(): Promise<CustomerInfo> {
    return this.request<CustomerInfo>('GET', 'client/customer');
  }

  getEntitlement(identifier: string): Promise<EntitlementStatus> {
    return this.request<EntitlementStatus>('GET', `client/entitlements/${encodeURIComponent(identifier)}`);
  }

  async isEntitled(identifier: string): Promise<boolean> {
    return (await this.getEntitlement(identifier)).is_active;
  }

  getOfferings(): Promise<CustomerOfferings> {
    return this.request<CustomerOfferings>('GET', 'client/offerings');
  }

  setAttributes(attributes: CustomerAttributes): Promise<CustomerInfo> {
    return this.request<CustomerInfo>('POST', 'client/attributes', { attributes });
  }

  private async request<T>(method: string, path: string, data?: unknown): Promise<T> {
    try {
      return await this.send<T>(method, path, data, false);
    } catch (error) {
      if (!(error instanceof ApiError) || error.errorCode !== 'TOKEN_INVALID') {
        throw error;
      }
      return await this.send<T>(method, path, data, true);
    }
  }

  private async send<T>(method: string, path: string, data: unknown, refreshToken: boolean): Promise<T> {
    try {
      if (!this.token || refreshToken) {
        this.token = await this.getCustomerToken();
      }

      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'X-Public-Key': this.publicKey,
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: data === undefined ? undefined : JSON.stringify(data)
      });
      const text = await response.text();
      let result: unknown;
      try {
        result = text ? (JSON.parse(text) as unknown) : {};
      } catch (error) {
        if (response.status >= 400) {
          throw apiError('Unknown error', response.status, undefined, response.headers);
        }
        throw error;
      }

      if (response.status >= 400) {
        throw apiError(this.extractErrorMessage(result), response.status, result, response.headers);
      }

      if (isJsonObject(result) && Object.prototype.hasOwnProperty.call(result, 'success')) {
        const envelope = result as ApiEnvelope;
        if (envelope.success === false) {
          throw apiError(this.extractErrorMessage(result), response.status, result, response.headers);
        }
        return envelope.data as T;
      }

      return result as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new NetworkError(`Failed to communicate with Tinker API: ${errorMessage(error)}`, error);
    }
  }

  private extractErrorMessage(result: unknown): string {
    if (isJsonObject(result)) {
      if (isJsonObject(result.error)) {
        return String(result.error.message || result.error.code || 'Unknown error');
      }
      if (result.message) {
        return String(result.message);
      }
    }
    return 'Unknown error';
  }
}
