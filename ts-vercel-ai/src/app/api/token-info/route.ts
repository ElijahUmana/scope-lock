import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';

interface JwtClaims {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  azp?: string;
  scope?: string;
  [key: string]: unknown;
}

export async function GET() {
  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tokenSet = session.tokenSet;

  // Decode the ID token claims (JWT payload) WITHOUT verification.
  // Auth0 already verified the token during session establishment —
  // we only need the public claims for display purposes.
  const idToken = tokenSet?.idToken;
  let claims: JwtClaims = {};
  if (idToken) {
    const parts = idToken.split('.');
    if (parts.length === 3) {
      try {
        claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      } catch {
        // Malformed token payload — leave claims empty
      }
    }
  }

  // Return safe metadata — NEVER return the actual token values
  return NextResponse.json({
    claims: {
      iss: claims.iss ?? null,
      sub: claims.sub ?? null,
      aud: claims.aud ?? null,
      exp: claims.exp ?? null,
      iat: claims.iat ?? null,
      azp: claims.azp ?? null,
      scope: claims.scope ?? null,
    },
    tokenPresence: {
      hasAccessToken: !!tokenSet?.accessToken,
      hasRefreshToken: !!tokenSet?.refreshToken,
      hasIdToken: !!tokenSet?.idToken,
      accessTokenExpiry: tokenSet?.expiresAt ?? null,
    },
  });
}
