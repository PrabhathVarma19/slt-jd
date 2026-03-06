import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/auth/session';
import { syncUserProfile } from '@/lib/api/sync-user-profile';
import { resolveLoginUser } from '@/lib/auth/resolve-login-user';
import {
  decodeJwtPayload,
  getAzureSsoConfig,
  normalizeRedirectPath,
  SSO_REDIRECT_COOKIE,
  SSO_STATE_COOKIE,
  SSO_VERIFIER_COOKIE,
} from '@/lib/auth/sso';

function clearSsoCookies(response: NextResponse) {
  response.cookies.set(SSO_STATE_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  response.cookies.set(SSO_REDIRECT_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  response.cookies.set(SSO_VERIFIER_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

function redirectToLogin(req: NextRequest, errorMessage: string, redirectPath: string) {
  const loginUrl = new URL('/login', req.url);
  const safeError = errorMessage.replace(/\s+/g, ' ').trim().slice(0, 220);
  loginUrl.searchParams.set('error', safeError);
  loginUrl.searchParams.set('redirect', redirectPath);
  const response = NextResponse.redirect(loginUrl);
  clearSsoCookies(response);
  return response;
}

async function resolveEmailFromTokenResponse(tokenJson: any): Promise<string | null> {
  const idToken = typeof tokenJson?.id_token === 'string' ? tokenJson.id_token : null;
  if (idToken) {
    const claims = decodeJwtPayload(idToken);
    const claimEmail =
      claims?.preferred_username || claims?.email || claims?.upn || claims?.unique_name;
    if (typeof claimEmail === 'string' && claimEmail.trim()) {
      return claimEmail;
    }
  }

  const accessToken = typeof tokenJson?.access_token === 'string' ? tokenJson.access_token : null;
  if (!accessToken) return null;

  try {
    const userInfoRes = await fetch('https://graph.microsoft.com/oidc/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userInfoRes.ok) return null;
    const userInfo = await userInfoRes.json();
    const infoEmail = userInfo?.preferred_username || userInfo?.email || userInfo?.upn;
    return typeof infoEmail === 'string' ? infoEmail : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const redirectFromCookie = normalizeRedirectPath(req.cookies.get(SSO_REDIRECT_COOKIE)?.value || '/');

  try {
    const { config, error } = getAzureSsoConfig(req);
    if (!config || error) {
      return redirectToLogin(req, error || 'Azure SSO is not configured.', redirectFromCookie);
    }

    const oauthError = req.nextUrl.searchParams.get('error');
    if (oauthError) {
      const description = req.nextUrl.searchParams.get('error_description') || oauthError;
      return redirectToLogin(req, `Microsoft login failed: ${description}`, redirectFromCookie);
    }

    const code = req.nextUrl.searchParams.get('code');
    const state = req.nextUrl.searchParams.get('state');
    const expectedState = req.cookies.get(SSO_STATE_COOKIE)?.value;

    if (!code || !state || !expectedState || state !== expectedState) {
      return redirectToLogin(req, 'Invalid SSO state. Please try again.', redirectFromCookie);
    }

    const codeVerifier = req.cookies.get(SSO_VERIFIER_COOKIE)?.value;
    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
      scope: 'openid profile email User.Read',
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
    });

    const tokenRes = await fetch(config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!tokenRes.ok) {
      const tokenErr = await tokenRes.json().catch(() => ({}));
      const detail = tokenErr?.error_description || tokenErr?.error || 'unknown';
      return redirectToLogin(
        req,
        `Microsoft token exchange failed (${tokenRes.status}): ${detail}`,
        redirectFromCookie
      );
    }

    const tokenJson = await tokenRes.json();
    const claimEmail = await resolveEmailFromTokenResponse(tokenJson);

    if (!claimEmail) {
      return redirectToLogin(req, 'Unable to resolve email from Microsoft login.', redirectFromCookie);
    }

    const normalizedEmail = claimEmail.toLowerCase().trim();
    const { user } = await resolveLoginUser(normalizedEmail);

    await createSession({
      userId: user.id,
      email: user.email,
      roles: user.roles,
    });

    syncUserProfile(normalizedEmail).catch((syncError) => {
      console.error('Background profile sync failed after SSO login:', syncError);
    });

    const successRedirect = new URL(redirectFromCookie, req.url);
    const response = NextResponse.redirect(successRedirect);
    clearSsoCookies(response);
    return response;
  } catch (error: any) {
    const message = error?.message || 'SSO login failed. Please try again.';
    return redirectToLogin(req, message, redirectFromCookie);
  }
}



