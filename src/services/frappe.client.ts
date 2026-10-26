/**
 * Shared client for the Frappe backend. Screens and hooks should not call
 * `fetch` directly; add a typed function to a `*.service.ts` file instead and
 * route it through `callFrappeMethod`.
 */
import { FRAPPE_API_KEY, FRAPPE_API_SECRET } from '../config';

export const BASE_URL = 'https://buyinminutes.u.frappe.cloud';

const API_METHOD_BASE = `${BASE_URL}/api/method`;
const API_RESOURCE_BASE = `${BASE_URL}/api/resource`;

type FrappeResponse<T> = { message: T };
type FrappeResourceResponse<T> = { data: T };

/**
 * Token auth header for the Frappe REST API, or `undefined` when no key is
 * bundled (calls then fall back to guest access).
 */
function frappeAuthHeaders(): Record<string, string> | undefined {
  if (!FRAPPE_API_KEY || !FRAPPE_API_SECRET) {
    return undefined;
  }
  return { Authorization: `token ${FRAPPE_API_KEY}:${FRAPPE_API_SECRET}` };
}

type ResourceListParams = {
  fields?: string[];
  /**
   * Frappe filter tuples, e.g. `[['customer', '=', 'CUST-0001']]`, or
   * `[childDoctype, field, op, value]` to filter on a child table's field.
   */
  filters?: Array<
    | [string, string, string | number | string[]]
    | [string, string, string, string | number | string[]]
  >;
  orderBy?: string;
  limit?: number;
  offset?: number;
};

/**
 * Resource reads pass `credentials: 'omit'` so React Native's persisted cookie
 * jar (which holds the website user's `sid` after OTP login) is neither sent
 * nor stored. Otherwise Frappe runs the request as that low-privilege website
 * user instead of the token's user and answers 403 "Insufficient Permission".
 *
 * List documents of a doctype via `GET /api/resource/<doctype>`.
 *
 * @param doctype e.g. `Sales Order`.
 * @param label   Human-readable name used in the thrown error message.
 */
export async function fetchResourceList<T>(
  doctype: string,
  params: ResourceListParams = {},
  label: string = doctype,
): Promise<T[]> {
  const query = new URLSearchParams();
  if (params.fields) {
    query.set('fields', JSON.stringify(params.fields));
  }
  if (params.filters) {
    query.set('filters', JSON.stringify(params.filters));
  }
  if (params.orderBy) {
    query.set('order_by', params.orderBy);
  }
  if (params.limit != null) {
    query.set('limit_page_length', String(params.limit));
  }
  if (params.offset != null) {
    query.set('limit_start', String(params.offset));
  }

  const response = await fetch(
    `${API_RESOURCE_BASE}/${encodeURIComponent(doctype)}?${query.toString()}`,
    { credentials: 'omit', headers: frappeAuthHeaders() },
  );

  if (!response.ok) {
    const detail = await describeFrappeError(response);
    throw new Error(
      `Failed to load ${label} (${response.status})${
        detail ? `: ${detail}` : ''
      }`,
    );
  }

  const { data }: FrappeResourceResponse<T[]> = await response.json();

  return data;
}

/**
 * Fetch a single document via `GET /api/resource/<doctype>/<name>`.
 */
export async function fetchResource<T>(
  doctype: string,
  name: string,
  label: string = `${doctype} ${name}`,
): Promise<T> {
  const response = await fetch(
    `${API_RESOURCE_BASE}/${encodeURIComponent(doctype)}/${encodeURIComponent(
      name,
    )}`,
    { credentials: 'omit', headers: frappeAuthHeaders() },
  );

  if (!response.ok) {
    throw new Error(`Failed to load ${label} (${response.status})`);
  }

  const { data }: FrappeResourceResponse<T> = await response.json();

  return data;
}

/**
 * Create a document via `POST /api/resource/<doctype>` (Frappe's generic
 * REST create API — no custom whitelisted method needed).
 *
 * @param doctype e.g. `Sales Order`.
 * @param data    Field values for the new document.
 * @param label   Human-readable name used in the thrown error message.
 */
export async function createResource<T>(
  doctype: string,
  data: Record<string, unknown>,
  label: string = doctype,
): Promise<T> {
  const response = await fetch(
    `${API_RESOURCE_BASE}/${encodeURIComponent(doctype)}`,
    {
      method: 'POST',
      // See `fetchResourceList` — keeps the website user's cookie from
      // overriding the token's user.
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        ...frappeAuthHeaders(),
      },
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    const detail = await describeFrappeError(response);
    throw new Error(
      `Failed to create ${label} (${response.status})${
        detail ? `: ${detail}` : ''
      }`,
    );
  }

  const { data: created }: FrappeResourceResponse<T> = await response.json();

  return created;
}

/**
 * Update a document via `PUT /api/resource/<doctype>/<name>`. Passing
 * `{docstatus: 1}` submits it.
 */
export async function updateResource<T>(
  doctype: string,
  name: string,
  data: Record<string, unknown>,
  label: string = `${doctype} ${name}`,
): Promise<T> {
  const response = await fetch(
    `${API_RESOURCE_BASE}/${encodeURIComponent(doctype)}/${encodeURIComponent(
      name,
    )}`,
    {
      method: 'PUT',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        ...frappeAuthHeaders(),
      },
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    const detail = await describeFrappeError(response);
    throw new Error(
      `Failed to update ${label} (${response.status})${
        detail ? `: ${detail}` : ''
      }`,
    );
  }

  const { data: updated }: FrappeResourceResponse<T> = await response.json();

  return updated;
}

/**
 * Prefix a Frappe file path with the site origin, or pass through `null`.
 * Paths that are already absolute URLs (e.g. images hosted off-site) are
 * returned as-is instead of being double-prefixed.
 */
export function toAbsoluteFileUrl(path: string | null): string | null {
  if (!path) {
    return null;
  }
  return /^https?:\/\//i.test(path) ? path : encodeURI(`${BASE_URL}${path}`);
}

/**
 * Flatten a Frappe rich-text (Text Editor) value to readable plain text:
 * block tags become line breaks, remaining tags are dropped, HTML entities are
 * decoded, and surrounding whitespace is collapsed. Returns `null` when empty.
 */
export function htmlToText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const text = value
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6]|tr|ul|ol)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code)),
    )
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text || null;
}

/**
 * Call a whitelisted Frappe method and unwrap its `message` envelope.
 *
 * @param method Dotted method path, e.g. `buy_in_minutes.api.get_items`.
 * @param params Optional query string parameters.
 * @param label Human-readable name used in the thrown error message.
 */
export async function callFrappeMethod<T>(
  method: string,
  params?: Record<string, string>,
  label: string = method,
): Promise<T> {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
  const response = await fetch(`${API_METHOD_BASE}/${method}${query}`, {
    headers: frappeAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${label} (${response.status})`);
  }

  const { message }: FrappeResponse<T> = await response.json();

  return message;
}

// `_server_messages` is a JSON array of JSON-encoded `{message}` objects
// whose text may contain HTML (e.g. `<strong>`); flatten it to plain text
// suitable for an Alert.
function parseServerMessages(raw?: string): string | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    const messages = (JSON.parse(raw) as string[])
      .map(entry => {
        try {
          return (JSON.parse(entry) as { message?: string }).message ?? entry;
        } catch {
          return entry;
        }
      })
      .map(message => message.replace(/<[^>]*>/g, '').trim())
      .filter(Boolean);
    return messages.length ? messages.join('\n') : undefined;
  } catch {
    return undefined;
  }
}

// Best-effort extraction of Frappe's actual error detail from a failed
// response, so callers/logs see e.g. "method not whitelisted" instead of
// just a bare status code.
async function describeFrappeError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    try {
      const data = JSON.parse(text) as {
        exception?: string;
        message?: string | {message?: string};
        _server_messages?: string;
      };
      // Endpoints that return `{success: false, message}` with an error
      // status nest the reason one level down.
      const message =
        typeof data.message === 'string' ? data.message : data.message?.message;
      return (
        parseServerMessages(data._server_messages) ??
        data.exception ??
        message ??
        text
      ).slice(0, 300);
    } catch {
      return text.slice(0, 300);
    }
  } catch {
    return '';
  }
}

export async function postFrappeMethod<T>(
  method: string,
  body: Record<string, unknown>,
  label: string = method,
): Promise<T> {
  const response = await fetch(`${API_METHOD_BASE}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...frappeAuthHeaders(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await describeFrappeError(response);
    throw new Error(
      `Failed to submit ${label} (${response.status})${
        detail ? `: ${detail}` : ''
      }`,
    );
  }

  const { message }: FrappeResponse<T> = await response.json();

  return message;
}

type PickedFile = {
  uri: string;
  name: string;
  type: string;
};

/**
 * Upload a file via Frappe's standard `/api/method/upload_file` endpoint and,
 * in the same call, attach it to a document's field (Frappe does both when
 * `doctype`/`docname`/`fieldname` are given alongside the file).
 */
export async function uploadFrappeFile(
  file: PickedFile,
  attach: { doctype: string; docname: string; fieldname: string },
  label: string = 'file',
): Promise<string> {
  const formData = new FormData();
  // React Native's FormData accepts this `{uri, name, type}` shape for file
  // parts, which the standard DOM `FormData`/`Blob` types don't model.
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as unknown as Blob);
  formData.append('doctype', attach.doctype);
  formData.append('docname', attach.docname);
  formData.append('fieldname', attach.fieldname);
  formData.append('is_private', '0');

  const response = await fetch(`${API_METHOD_BASE}/upload_file`, {
    method: 'POST',
    headers: frappeAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload ${label} (${response.status})`);
  }

  const { message }: FrappeResponse<{ file_url: string }> =
    await response.json();

  return message.file_url;
}
