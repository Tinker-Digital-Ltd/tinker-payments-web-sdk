export const PRODUCTION_BASE_URL = 'https://api.tinkerpayments.com';
export const SANDBOX_BASE_URL = 'https://sandbox-api.tinkerpayments.com';
const API_VERSION_PATH = '/v1';

export function resolveBaseUrl(publicKey: string, baseUrl?: string | null): string {
  let url = baseUrl && baseUrl.trim() ? baseUrl : publicKey.startsWith('pk_test_') ? SANDBOX_BASE_URL : PRODUCTION_BASE_URL;
  url = url.replace(/\/+$/, '');
  if (!url.endsWith(API_VERSION_PATH)) {
    url += API_VERSION_PATH;
  }
  return `${url}/`;
}
