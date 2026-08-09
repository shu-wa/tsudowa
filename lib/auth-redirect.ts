export const NATIVE_ONBOARDING_REDIRECT = 'tsudowa://onboarding';
export const NATIVE_RESET_PASSWORD_REDIRECT = 'tsudowa://reset-password';

const ALLOWED_ROUTES = new Set(['onboarding', 'reset-password']);
const MAX_CODE_LENGTH = 512;
const MAX_TOKEN_LENGTH = 8192;

type ParseOptions = {
  webOrigin?: string | null;
  allowDevelopment?: boolean;
};

export type AuthCallbackParams = {
  route: 'onboarding' | 'reset-password';
  code?: string;
  tokenHash?: string;
  type?: string;
  accessToken?: string;
  refreshToken?: string;
  errorDescription?: string;
};

const bounded = (value: string | null, maximum: number) => (
  value && value.length <= maximum ? value : undefined
);

export const parseAuthCallbackUrl = (url: string, options: ParseOptions = {}): AuthCallbackParams | null => {
  try {
    const parsed = new URL(url);
    const webOrigin = options.webOrigin ?? null;
    const developmentProtocol = parsed.protocol === 'exp:'
      || (['http:', 'https:'].includes(parsed.protocol) && ['localhost', '127.0.0.1'].includes(parsed.hostname));
    const allowedProtocol = parsed.protocol === 'tsudowa:'
      || (webOrigin !== null && parsed.origin === webOrigin)
      || (options.allowDevelopment === true && developmentProtocol);
    if (!allowedProtocol) return null;

    const routeParts = [parsed.hostname, ...parsed.pathname.split('/')].filter(Boolean);
    // Supabase custom email templates may append `/auth/confirm` after the
    // app route, so accept the first allow-listed route segment.
    const route = routeParts.find((part) => ALLOWED_ROUTES.has(part));
    if (!route || !ALLOWED_ROUTES.has(route)) return null;

    const query = parsed.searchParams;
    const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));
    const get = (name: string) => query.get(name) ?? fragment.get(name);

    return {
      route: route as AuthCallbackParams['route'],
      code: bounded(get('code'), MAX_CODE_LENGTH),
      tokenHash: bounded(get('token_hash'), MAX_TOKEN_LENGTH),
      type: bounded(get('type'), 32),
      accessToken: bounded(get('access_token'), MAX_TOKEN_LENGTH),
      refreshToken: bounded(get('refresh_token'), MAX_TOKEN_LENGTH),
      errorDescription: bounded(get('error_description') ?? get('error'), 500),
    };
  } catch {
    return null;
  }
};
