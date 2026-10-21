/* eslint-env node */
/**
 * Stub Identity Provider (ephemeral; no dependency, no committed key). Proves the production
 * same-origin flow: /auth/login handles redirect, /api/token issues a signed JWT, /oauth2/jwks
 * publishes the key the TinyURL resource server validates against.
 */
import { createServer } from 'node:http';
import { createSign, generateKeyPairSync } from 'node:crypto';

const ISSUER = process.env.STUB_ISSUER ?? 'http://stub-identity:8090';
const PORT = Number(process.env.PORT ?? 8090);

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
function base64url(buffer) {
  return buffer.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
const nBase64url = base64url(publicKey.export({ type: 'spki', format: 'der' }));

function jwks() {
  // Derive n/e from the PKCS#1 SPKI DER via a tiny ASN.1 walk is overkill for a stub; instead
  // keep the JWKS from JWK export of the key object.
  const jwk = publicKey.export({ format: 'jwk' });
  return {
    keys: [
      { kty: jwk.kty, use: 'sig', alg: 'RS256', kid: jwk.kid ?? 'stub-key', n: jwk.n, e: jwk.e },
    ],
  };
}

function issueToken(code) {
  if (code !== 'stub-code') {
    return { status: 400, body: { error: 'invalid_code' } };
  }
  const header = { alg: 'RS256', typ: 'JWT', kid: 'stub-key' };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: ISSUER,
    sub: 'stub-user',
    preferred_username: 'stub-user',
    email: 'stub-user@example.invalid',
    name: 'Stub User',
    role: 'admin',
    iat: now,
    exp: now + 3600,
  };
  const head = base64url(Buffer.from(JSON.stringify(header)));
  const payload = base64url(Buffer.from(JSON.stringify(claims)));
  const signature = base64url(
    createSign('RSA-SHA256').update(`${head}.${payload}`).sign(privateKey),
  );
  return {
    status: 200,
    body: {
      accessToken: `${head}.${payload}.${signature}`,
      tokenType: 'Bearer',
      expiresIn: 3600,
      principal: {
        id: 'stub-user',
        login: 'stub-user',
        email: 'stub-user@example.invalid',
        displayName: 'Stub User',
        role: 'admin',
      },
    },
  };
}

createServer((request, response) => {
  const url = new URL(request.url, ISSUER);
  response.setHeader('content-type', 'application/json');
  if (url.pathname === '/health') {
    response.end(JSON.stringify({ status: 'UP' }));
    return;
  }
  if (url.pathname === '/oauth2/jwks') {
    response.end(JSON.stringify(jwks()));
    return;
  }
  if (url.pathname === '/auth/login') {
    // Only same-origin (the image's exposed port) redirect targets; not an open redirect.
    const redirect = url.searchParams.get('redirect') ?? '';
    if (redirect.startsWith('http://localhost:18088/')) {
      const joined = redirect.includes('?') ? '&' : '?';
      response.setHeader('location', `${redirect}${joined}code=stub-code`);
      response.statusCode = 302;
      response.end();
    } else {
      response.statusCode = 400;
      response.end(JSON.stringify({ error: 'invalid_redirect' }));
    }
    return;
  }
  if (url.pathname === '/api/token') {
    let raw = '';
    request.on('data', (chunk) => {
      raw += chunk;
    });
    request.on('end', () => {
      let code = '';
      try {
        // The shared auth contract posts JSON {code}; CI tool callers use form-encoding.
        const parsed = JSON.parse(raw);
        if (typeof parsed.code === 'string') code = parsed.code;
      } catch {
        code = new URLSearchParams(raw).get('code') ?? '';
      }
      const token = issueToken(code);
      response.statusCode = token.status;
      response.end(JSON.stringify(token.body));
    });
    return;
  }
  response.statusCode = 404;
  response.end(JSON.stringify({ error: 'not_found' }));
}).listen(PORT, () => {
  console.log(`stub identity on :${PORT} (issuer ${ISSUER})`);
});
