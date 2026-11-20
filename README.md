# tinker-payments-web-sdk

Browser SDK for Tinker Payments customer access. It never holds your app secret: it uses your public key and a short-lived customer token.

## Install

```sh
npm install tinker-payments-web-sdk
```

## Setup

Your backend mints the customer token with the server SDK (`POST /v1/merchant/customers/{id}/token`). Pass a callback that fetches it:

```ts
import { TinkerClient } from 'tinker-payments-web-sdk';

const tinker = new TinkerClient({
  publicKey: 'pk_live_...',
  getCustomerToken: async () => (await fetch('/api/tinker-token')).text()
});
```

The token is cached. On a `TOKEN_INVALID` response the SDK calls `getCustomerToken` again and retries the request once.

Keys starting with `pk_test_` use `https://sandbox-api.tinkerpayments.com`, others `https://api.tinkerpayments.com`. Pass `baseUrl` to override (`/v1` is appended if missing).

## Usage

```ts
const info = await tinker.getCustomerInfo();

const entitlement = await tinker.getEntitlement('pro');
const hasPro = await tinker.isEntitled('pro');

const { current_offering_identifier, offerings } = await tinker.getOfferings();

await tinker.setAttributes({ plan_hint: 'annual', old_key: null });
```

`getCustomerInfo` returns 404 `CUSTOMER_NOT_FOUND` for a customer with no purchases, promotions or attributes yet.

`setAttributes` rejects keys starting with `$` with 403 `RESERVED_ATTRIBUTE`; those are set from the server only.

Errors are `errors.ApiError` (with `errorCode`, `status`, `requestId`), `errors.FeatureNotSupportedError` or `errors.NetworkError`, matching the server SDKs.

## Purchases

Purchases are started from your backend with the server SDK's payment initiate, using `productId`, `externalCustomerId` and `presentedOfferingId`.

## Hosted paywall

```ts
const url = await tinker.paywallUrl({ returnUrl: 'https://app.example.com/after-purchase', offering: 'default' });
window.location.assign(url);
```

The URL carries `pk`, the current customer token, `return_url` and the optional `offering` (omit it for the current offering), all URL-encoded. `returnUrl` must be `https`, or `http://localhost`. The customer comes back to `returnUrl` with `package`, `offering`, `product_id` and `billing_period` appended. Pass `paywallBaseUrl` to override the site origin (default `https://tinkerpayments.com`, path `/paywall`).

## Options

- `fetch`: custom fetch implementation, useful for tests.
