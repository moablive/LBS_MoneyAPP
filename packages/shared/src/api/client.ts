export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`HTTP ${status}`);
  }
}

export interface ApiOptions {
  baseUrl: string;
  getToken: () => string | null;
  onUnauthorized: () => void;
}

export const apiOptions: ApiOptions = {
  baseUrl: '/api',
  getToken: () => null,
  onUnauthorized: () => {},
};

export function setupApi(options: Partial<ApiOptions>) {
  Object.assign(apiOptions, options);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  
  const token = apiOptions.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${apiOptions.baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401) {
    apiOptions.onUnauthorized();
    throw new ApiError(401, await safeJson(res));
  }
  if (!res.ok) throw new ApiError(res.status, await safeJson(res));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export const api = {
  get:    <T>(p: string)                  => request<T>('GET',    p),
  post:   <T>(p: string, body?: unknown)  => request<T>('POST',   p, body),
  put:    <T>(p: string, body?: unknown)  => request<T>('PUT',    p, body),
  patch:  <T>(p: string, body?: unknown)  => request<T>('PATCH',  p, body),
  delete: <T>(p: string)                  => request<T>('DELETE', p),
};

/** Reads a File or Blob into the base64 payload our `receiptSchema` expects. */
export function fileToBase64(file: Blob): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => {
      const result = String(r.result);
      const comma = result.indexOf(',');
      resolve({ mimeType: file.type, base64: comma >= 0 ? result.slice(comma + 1) : result });
    };
    r.readAsDataURL(file);
  });
}
