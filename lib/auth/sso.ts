import { NextRequest } from 'next/server';

export const SSO_STATE_COOKIE = 'beacon_sso_state';
export const SSO_REDIRECT_COOKIE = 'beacon_sso_redirect';
export const SSO_VERIFIER_COOKIE = 'beacon_sso_verifier';

interface AzureSsoConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizeEndpoint: string;
  tokenEndpoint: string;
}

function trimSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function resolveAppBaseUrl(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return trimSlash(configured);
  return trimSlash(req.nextUrl.origin);
}

export function resolveSsoRedirectUri(req: NextRequest): string {
  const configured = process.env.AZURE_REDIRECT_URI?.trim();
  if (configured) return configured;
  return `${resolveAppBaseUrl(req)}/api/auth/sso/callback`;
}

export function getAzureSsoConfig(req: NextRequest): { config?: AzureSsoConfig; error?: string } {
  const tenantId = process.env.AZURE_TENANT_ID?.trim();
  const clientId = process.env.AZURE_CLIENT_ID?.trim();
  const clientSecret = process.env.AZURE_CLIENT_SECRET?.trim();

  if (!tenantId || !clientId || !clientSecret) {
    return {
      error:
        'Missing Azure SSO configuration. Please set AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET.',
    };
  }

  const redirectUri = resolveSsoRedirectUri(req);

  return {
    config: {
      tenantId,
      clientId,
      clientSecret,
      redirectUri,
      authorizeEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
      tokenEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    },
  };
}

export function normalizeRedirectPath(path?: string | null): string {
  if (!path) return '/';
  const trimmed = path.trim();
  if (!trimmed.startsWith('/')) return '/';
  if (trimmed.startsWith('//')) return '/';
  return trimmed;
}

export function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const json = Buffer.from(padded, 'base64').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}
