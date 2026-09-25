export class ApiError extends Error {
  constructor(status, body = {}) {
    super(body.message ?? 'Something went wrong.');
    this.status = status;
    this.code = body.code;
    this.fields = body.fields ?? {};
    this.data = body.data;
  }
  /** True when the phone could not reach the server at all. */
  get isNetwork() {
    return this.code === 'NETWORK';
  }
}

const toQuery = (query) => {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') params.set(k, v);
  const s = params.toString();
  return s ? `?${s}` : '';
};

/**
 * Small fetch wrapper. JSON in / JSON out, FormData for photo uploads.
 * @param {{ base?: string, getToken: () => string|null, onUnauthorized?: () => void }} opts
 */
export function createApi({ base = '/api', getToken, onUnauthorized }) {
  async function request(method, path, { body, form, query, blob } = {}) {
    const headers = {};
    const token = getToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload;
    if (form) payload = form;
    else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(base + path + toQuery(query), { method, headers, body: payload });
    } catch {
      throw new ApiError(0, { message: 'No internet. Please check your connection.', code: 'NETWORK' });
    }
    if (res.status === 401) onUnauthorized?.();
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new ApiError(res.status, json.error ?? { message: `Request failed (${res.status})` });
    }
    if (blob) return res;
    return res.status === 204 ? null : res.json();
  }

  return {
    get: (path, query) => request('GET', path, { query }),
    post: (path, body) => request('POST', path, { body }),
    put: (path, body) => request('PUT', path, { body }),
    patch: (path, body) => request('PATCH', path, { body }),
    upload: (path, form) => request('POST', path, { form }),
    /** Download a file (e.g. Excel export) with the auth header. */
    async download(path, query) {
      const res = await request('GET', path, { query, blob: true });
      const name = /filename="?([^"]+)"?/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'download';
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement('a'), { href: url, download: name });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };
}
