interface Env {
  FIREBASE_PROJECT_ID: string;
  APP_ORIGINS: string;
  ALLOWED_EMAILS: string;
  KAKAO_REST_API_KEY?: string;
}

type Precision = 'place' | 'address' | 'street' | 'area' | 'unknown';
type Hit = { id: string; title: string; address: string; lat: number; lng: number; source: 'kakao' | 'openstreetmap'; precision: Precision; distance?: number };

/** Bisogni da cercare vicino a un punto: codice categoria Kakao oppure parola chiave coreana. */
const NEEDS: Record<string, { code?: string; keyword?: string }> = {
  toilet: { keyword: '화장실' },
  pharmacy: { code: 'PM9' },
  convenience: { code: 'CS2' },
  atm: { keyword: 'ATM' },
  cafe: { code: 'CE7' }
};

async function kakaoNearby(need: { code?: string; keyword?: string }, lat: number, lng: number, key: string): Promise<Hit[]> {
  const common = { x: String(lng), y: String(lat), radius: '800', sort: 'distance', size: '8' };
  const url = need.code
    ? `https://dapi.kakao.com/v2/local/search/category.json?${new URLSearchParams({ ...common, category_group_code: need.code })}`
    : `https://dapi.kakao.com/v2/local/search/keyword.json?${new URLSearchParams({ ...common, query: need.keyword ?? '' })}`;
  const response = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new ProviderError(`kakao:${response.status}`);
  const data = await response.json() as { documents?: Array<Record<string, unknown>> };
  return (data.documents ?? []).flatMap((doc) => {
    const hitLat = Number(doc.y), hitLng = Number(doc.x);
    if (!Number.isFinite(hitLat) || !Number.isFinite(hitLng)) return [];
    const distance = Number(doc.distance);
    return [{
      id: `kakao:${String(doc.id || `${hitLat},${hitLng}`)}`,
      title: String(doc.place_name || ''),
      address: String(doc.road_address_name || doc.address_name || ''),
      lat: hitLat, lng: hitLng, source: 'kakao' as const, precision: 'place' as const,
      ...(Number.isFinite(distance) ? { distance } : {})
    }];
  }).filter((hit) => hit.title);
}
type Claims = { aud: string; iss: string; sub: string; exp: number; iat: number; email?: string; email_verified?: boolean; firebase?: { sign_in_provider?: string } };

type FirebaseJwk = JsonWebKey & { kid?: string };
let cachedKeys: { expiresAt: number; keys: FirebaseJwk[] } | null = null;
const windows = new Map<string, { start: number; count: number }>();
const corsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin'
});
const json = (body: unknown, status: number, origin: string) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8' } });

function decodePart(part: string): Record<string, unknown> {
  return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
}

async function firebaseClaims(token: string, projectId: string): Promise<Claims> {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw new Error('token');
  const header = decodePart(encodedHeader) as { alg?: string; kid?: string };
  if (header.alg !== 'RS256' || !header.kid) throw new Error('token');
  if (!cachedKeys || cachedKeys.expiresAt < Date.now()) {
    const response = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
    if (!response.ok) throw new Error('keys');
    const data = await response.json() as { keys: FirebaseJwk[] };
    cachedKeys = { keys: data.keys, expiresAt: Date.now() + 50 * 60_000 };
  }
  const jwk = cachedKeys.keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error('key');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const data = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const signature = Uint8Array.from(atob(encodedSignature.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data)) throw new Error('signature');
  const claims = decodePart(encodedPayload) as unknown as Claims;
  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}` || !claims.sub || claims.sub.length > 128 || claims.exp <= now || claims.iat > now + 60) throw new Error('claims');
  if (!claims.email || claims.email_verified !== true || claims.firebase?.sign_in_provider !== 'google.com') throw new Error('account');
  return claims;
}

function variants(query: string): string[] {
  const romanized = query.replace(/([a-z])dong-(gil|ro)\b/gi, '$1-dong-$2');
  return [...new Set([query, romanized])];
}
/** Indirizzo stradale: romanizzato ("110 Sejong-daero") o coreano ("세종대로 110", "서울 중구 세종대로 110"), oppure a lotto ("동교동 160-1"). */
function addressQuery(q: string) {
  return (
    /^\d+(?:-\d+)?\s+.+-[a-z]*(?:ro|gil)\b/i.test(q) ||
    /(?:로|길)\s*\d+(?:-\d+)?(?:\s|$)/.test(q) ||
    /(?:동|리|가)\s+\d+(?:-\d+)?(?:\s|$)/.test(q)
  );
}
function kakaoHits(data: { documents?: Array<Record<string, unknown>> }, q: string, isAddress: boolean): Hit[] {
  return (data.documents ?? []).flatMap((doc) => {
    const lat = Number(doc.y), lng = Number(doc.x);
    const road = doc.road_address as Record<string, unknown> | null;
    const number = road?.main_building_no ? `${road.main_building_no}${road.sub_building_no && road.sub_building_no !== '0' ? `-${road.sub_building_no}` : ''}` : '';
    const requested = q.match(/(?:^|\s)(\d+(?:-\d+)?)(?=\s|$)/)?.[1];
    const precision: Precision = !isAddress ? 'place' : requested && number === requested ? 'address' : doc.address_type === 'ROAD_ADDR' ? 'street' : 'area';
    const address = String(road?.address_name || doc.address_name || '');
    const title = String(doc.place_name || road?.building_name || address || q);
    if (!title || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [{ id: `kakao:${String(doc.id || `${lat},${lng}`)}`, title, address, lat, lng, source: 'kakao' as const, precision }];
  });
}
/** Errore del fornitore: il messaggio è solo stato e tipo (es. "kakao:403:NotAuthorizedError"), mai la query o la chiave. */
class ProviderError extends Error {}
const AUTH_ERRORS = new Set(['token', 'keys', 'key', 'signature', 'claims', 'account']);

async function kakaoSearch(q: string, key: string, isAddress: boolean): Promise<Hit[]> {
  const endpoint = isAddress ? 'address' : 'keyword';
  const response = await fetch(`https://dapi.kakao.com/v2/local/search/${endpoint}.json?${new URLSearchParams({ query: q, size: '5' })}`, { headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(7000) });
  if (!response.ok) {
    // Kakao returns a small JSON error object (usually `code` and `msg`).
    // Log only those fields: never log the search query or request headers/key.
    let providerCode: number | string | undefined;
    let providerMessage: string | undefined;
    try {
      const body = await response.text();
      const detail = JSON.parse(body) as { code?: unknown; msg?: unknown; errorType?: unknown; message?: unknown };
      if (typeof detail.code === 'number') providerCode = detail.code;
      else if (typeof detail.errorType === 'string') providerCode = detail.errorType.slice(0, 60);
      const text = typeof detail.msg === 'string' ? detail.msg : typeof detail.message === 'string' ? detail.message : undefined;
      // Con una chiave sbagliata Kakao la ripete nel messaggio ("appKey(…) does not exist"): la si oscura sempre
      if (text) providerMessage = text.replace(/appKey\([^)]*\)/gi, 'appKey(***)').replace(/[0-9a-f]{32}/gi, '***').slice(0, 160);
    } catch {
      // A non-JSON provider response still leaves status as useful diagnostic data.
    }
    console.warn('Map search provider returned HTTP error', {
      provider: 'kakao',
      status: response.status,
      ...(providerCode === undefined ? {} : { providerCode }),
      ...(providerMessage === undefined ? {} : { providerMessage })
    });
    throw new ProviderError(`kakao:${response.status}${providerCode !== undefined ? `:${providerCode}` : ''}`);
  }
  return kakaoHits(await response.json() as { documents?: Array<Record<string, unknown>> }, q, isAddress);
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') || '';
    const origins = env.APP_ORIGINS.split(',').map((item) => item.trim());
    if (!origins.includes(origin)) {
      console.warn('Map search request rejected: origin is not allowlisted');
      return new Response('Origin not allowed', { status: 403 });
    }
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);
    try {
      const authorization = request.headers.get('Authorization') || '';
      const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
      const claims = await firebaseClaims(token, env.FIREBASE_PROJECT_ID);
      const allowed = (env.ALLOWED_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);
      const email = claims.email!.toLowerCase();
      if (!allowed.length || !allowed.includes(email)) return json({ error: 'Not a trip participant' }, 403, origin);
      const now = Date.now(), window = windows.get(claims.sub);
      if (window && now - window.start < 60_000 && window.count >= 12) return json({ error: 'Rate limit' }, 429, origin);
      windows.set(claims.sub, !window || now - window.start >= 60_000 ? { start: now, count: 1 } : { ...window, count: window.count + 1 });
      const body = await request.json() as { query?: unknown; need?: unknown; lat?: unknown; lng?: unknown };
      if (typeof body.need === 'string') {
        // Ricerca per bisogno: solo punti in Corea, solo bisogni dell'elenco
        const need = NEEDS[body.need];
        const lat = Number(body.lat), lng = Number(body.lng);
        if (!need || !(lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132)) return json({ error: 'Bad request' }, 400, origin);
        const nearbyKey = env.KAKAO_REST_API_KEY?.trim();
        if (!nearbyKey) return json({ hits: [], providers: [], providerConfigured: false, providerErrors: [] }, 200, origin);
        try {
          const found = await kakaoNearby(need, lat, lng, nearbyKey);
          console.info('Map nearby request completed', { need: body.need, resultCount: found.length });
          return json({ hits: found, providers: found.length ? ['kakao'] : [], providerConfigured: true, providerErrors: [] }, 200, origin);
        } catch (error) {
          const reason = error instanceof ProviderError ? error.message : 'kakao:network';
          console.warn('Map nearby request failed', { reason });
          return json({ hits: [], providers: [], providerConfigured: true, providerErrors: [reason] }, 200, origin);
        }
      }
      const query = typeof body.query === 'string' ? body.query.normalize('NFKC').replace(/[‐‑‒–—]/g, '-').replace(/[\s,]+/g, ' ').trim().slice(0, 160) : '';
      if (query.length < 3) return json({ error: 'Enter at least 3 characters' }, 400, origin);
      const isAddress = addressQuery(query);
      const key = env.KAKAO_REST_API_KEY?.trim();
      const searches = key
        ? [
            ...(isAddress ? variants(query).map((q) => kakaoSearch(q, key, true)) : []),
            kakaoSearch(query, key, false)
          ]
        : [];
      const sets = await Promise.allSettled(searches);
      const hits = sets.flatMap((set) => set.status === 'fulfilled' ? set.value : []);
      const providerErrors = [...new Set(sets.flatMap((set) => set.status === 'rejected' ? [set.reason instanceof ProviderError ? set.reason.message : 'kakao:network'] : []))];
      console.info('Map search request completed', {
        providerConfigured: Boolean(env.KAKAO_REST_API_KEY),
        queryKind: isAddress ? 'road-address' : 'place',
        providerRequests: searches.length,
        successfulRequests: sets.filter((set) => set.status === 'fulfilled').length,
        resultCount: hits.length,
        ...(providerErrors.length ? { providerErrors } : {})
      });
      const unique: Hit[] = [];
      for (const hit of hits) {
        const index = unique.findIndex((item) => Math.hypot((item.lat - hit.lat) * 111320, (item.lng - hit.lng) * 88000) < 25);
        if (index < 0) unique.push(hit);
        else if (hit.precision === 'address' && unique[index].precision !== 'address') unique[index] = hit;
      }
      // providerErrors e providerConfigured aiutano l'app (e chi fa debug) a capire perché Kakao non risponde
      return json({ hits: unique.slice(0, 10), providers: [...new Set(hits.map((hit) => hit.source))], providerConfigured: Boolean(key), providerErrors }, 200, origin);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown';
      console.warn('Map search request rejected or failed', { reason });
      if (AUTH_ERRORS.has(reason)) return json({ error: 'Not signed in' }, 401, origin);
      if (error instanceof SyntaxError) return json({ error: 'Bad request' }, 400, origin);
      return json({ error: 'Search failed' }, 500, origin);
    }
  }
};
