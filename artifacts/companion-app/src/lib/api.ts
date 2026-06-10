import { setAuthTokenGetter } from "@workspace/api-client-react/custom-fetch";

let telegramInitData: string | null = null;

export function setInitData(data: string) {
  telegramInitData = data;
}

// Intercept all API calls and attach the Telegram init data as a header.
// Note: We use a custom fetch wrapper or configure the generated clients.
// For @workspace/api-client-react/custom-fetch, we can provide an auth getter,
// but since this is x-telegram-init-data, we may need to inject it differently 
// if it doesn't accept bearer token natively, or we can use the original fetch override.

// Actually, custom-fetch.ts allows custom fetch headers. Let's override the global fetch to include it.
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  if (telegramInitData) {
    if (!init) {
      init = {};
    }
    const headers = new Headers(init.headers);
    headers.set("x-telegram-init-data", telegramInitData);
    init.headers = headers;
  }
  return originalFetch(input, init);
};
