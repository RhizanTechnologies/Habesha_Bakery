export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
export const BASE_URL = API_URL.replace(/\/api\/?$/, '');

export function getFileUrl(pathOrUrl?: string | null): string | null {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://') || pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('blob:')) {
    return pathOrUrl;
  }
  return `${BASE_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

// Client-side in-memory cache for idempotent GET requests to slash network latency
interface CacheEntry {
  data: any;
  expiry: number;
}
const apiCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<{ data?: any; error?: string }>>();

// Default cache TTL in milliseconds for GET requests
export const DEFAULT_CACHE_TTL_MS = 60_000; // 60 seconds

// Endpoints that should NOT be cached automatically
const NON_CACHEABLE_ENDPOINTS = [
  '/auth/logout',
  '/attendance/kiosk/verify',
];

// Cross-domain mutation invalidation matrix
const MUTATION_INVALIDATION_RULES: Record<string, string[]> = {
  '/production': ['/production', '/stock', '/dashboard', '/reports'],
  '/daily-sessions': ['/daily-sessions', '/dashboard', '/reports'],
  '/expenses': ['/expenses', '/dashboard', '/reports'],
  '/attendance': ['/attendance', '/dashboard'],
  '/customer-credits': ['/customer-credits', '/dashboard', '/reports'],
  '/owner-loans': ['/owner-loans', '/dashboard', '/reports'],
  '/payroll': ['/payroll', '/dashboard'],
  '/stock': ['/stock', '/production', '/dashboard'],
  '/products': ['/products', '/production', '/stock', '/dashboard'],
  '/branches': ['/branches', '/dashboard'],
  '/suppliers': ['/suppliers', '/stock'],
  '/users': ['/users', '/dashboard', '/attendance'],
};

export function clearApiCache(endpointPrefixOrPrefixes?: string | string[]) {
  if (!endpointPrefixOrPrefixes) {
    apiCache.clear();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('api-cache-cleared'));
    }
    return;
  }
  const prefixes = Array.isArray(endpointPrefixOrPrefixes) ? endpointPrefixOrPrefixes : [endpointPrefixOrPrefixes];
  for (const key of Array.from(apiCache.keys())) {
    for (const prefix of prefixes) {
      if (key.includes(prefix)) {
        apiCache.delete(key);
        break;
      }
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('api-cache-invalidated', { detail: { prefixes } }));
  }
}

/**
 * Synchronously retrieves cached data for an endpoint if present and not expired.
 */
export function getCachedApiData<T = any>(endpoint: string): T | null {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('token') || localStorage.getItem('habesha_token')
      : null;
  const cacheKey = `${token ? 'auth' : 'anon'}:GET:${endpoint}`;
  const cached = apiCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.data as T;
  }
  return null;
}

/**
 * Programmatically populate or update cached data for an endpoint.
 */
export function setCachedApiData<T = any>(endpoint: string, data: T, ttlMs: number = DEFAULT_CACHE_TTL_MS): void {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('token') || localStorage.getItem('habesha_token')
      : null;
  const cacheKey = `${token ? 'auth' : 'anon'}:GET:${endpoint}`;
  apiCache.set(cacheKey, { data, expiry: Date.now() + ttlMs });
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit & {
    cacheTtlMs?: number;
    skipCache?: boolean;
    staleWhileRevalidate?: boolean;
  } = {}
): Promise<{ data?: T; error?: string }> {
  const method = (options.method || 'GET').toUpperCase();

  // If a mutation is made, invalidate relevant cache keys
  if (method !== 'GET') {
    let matched = false;
    for (const [triggerPath, invalidations] of Object.entries(MUTATION_INVALIDATION_RULES)) {
      if (endpoint.includes(triggerPath)) {
        clearApiCache(invalidations);
        matched = true;
      }
    }
    if (!matched) {
      clearApiCache(['/dashboard', '/reports']);
    }
  }

  // Check in-memory cache for GET requests
  const isExcluded = NON_CACHEABLE_ENDPOINTS.some((prefix) => endpoint.startsWith(prefix));
  const isCacheable =
    method === 'GET' &&
    !options.skipCache &&
    options.cache !== 'no-store' &&
    !isExcluded;

  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('token') || localStorage.getItem('habesha_token')
      : null;

  const cacheKey = `${token ? 'auth' : 'anon'}:${method}:${endpoint}`;

  if (isCacheable) {
    const cached = apiCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return { data: cached.data as T };
    }
  }

  // In-flight request deduplication for concurrent identical GETs
  if (method === 'GET' && inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey) as Promise<{ data?: T; error?: string }>;
  }

  const fetchPromise = (async () => {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    // Only set application/json if body is NOT FormData
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const isExempt = endpoint.includes('/auth/login') || endpoint.includes('/settings');
        if (
          res.status === 401 &&
          !isExempt &&
          typeof window !== 'undefined' &&
          window.location.pathname !== '/login' &&
          !window.location.pathname.startsWith('/attendance/kiosk')
        ) {
          localStorage.removeItem('token');
          localStorage.removeItem('habesha_token');
          localStorage.removeItem('erp_user');
          window.dispatchEvent(new Event('auth-error'));
        }
        return { error: json.error || `Request failed with status ${res.status}` };
      }

      // Store in cache if eligible
      if (isCacheable) {
        const ttl = options.cacheTtlMs || DEFAULT_CACHE_TTL_MS;
        apiCache.set(cacheKey, { data: json, expiry: Date.now() + ttl });
      }

      return { data: json as T };
    } catch (err: any) {
      return { error: err.message || 'Network error connecting to API server.' };
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  if (method === 'GET') {
    inFlightRequests.set(cacheKey, fetchPromise);
  }

  return fetchPromise;
}
