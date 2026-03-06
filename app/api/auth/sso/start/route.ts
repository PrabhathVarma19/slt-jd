import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  getAzureSsoConfig,
  normalizeRedirectPath,
  SSO_REDIRECT_COOKIE,
  SSO_STATE_COOKIE,
} from '@/lib/auth/sso';

export async function GET(req: NextRequest) {
  const redirectTo = normalizeRedirectPath(req.nextUrl.searchParams.get('redirect'));
  const { config, error } = getAzureSsoConfig(req);

  if (!config || error) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('error', error || 'Azure SSO is not configured.');
    loginUrl.searchParams.set('redirect', redirectTo);
    return NextResponse.redirect(loginUrl);
  }

  const state = randomUUID();
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    response_mode: 'query',
    scope: 'openid profile email User.Read',
    state,
    prompt: 'select_account',
  });

  const authorizeUrl = `${config.authorizeEndpoint}?${params.toString()}`;
  const response = NextResponse.redirect(authorizeUrl);

  response.cookies.set(SSO_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  });

  response.cookies.set(SSO_REDIRECT_COOKIE, redirectTo, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  });

  return response;
}

