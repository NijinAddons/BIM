import {logger} from '../../utils/logger';
import {ApiError} from './apiError';

type RequestOptions = {
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  logLabel?: string;
};

type RequestResult<T> = {
  data: T;
  rawBody: string;
  response: Response;
};

const parseResponseBody = <T>(body: string): T | null => {
  if (!body) {
    return null;
  }

  return JSON.parse(body) as T;
};

const request = async <T>(
  method: 'GET' | 'POST',
  url: string,
  options: RequestOptions = {},
): Promise<RequestResult<T>> => {
  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      ...(options.body ? {'Content-Type': 'application/json'} : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const contentType = response.headers.get('content-type') ?? 'unknown';
  const rawBody = await response.text();

  logger.log(options.logLabel ?? 'API response', {
    url,
    status: response.status,
    ok: response.ok,
    contentType,
    body: rawBody,
  });

  if (!response.ok) {
    throw new ApiError(`Request failed with status ${response.status}`, {
      status: response.status,
      url,
      body: rawBody,
    });
  }

  if (contentType.includes('text/html')) {
    throw new ApiError('Expected JSON response but received HTML.', {
      status: response.status,
      url,
      body: rawBody,
    });
  }

  try {
    return {
      data: parseResponseBody<T>(rawBody) as T,
      rawBody,
      response,
    };
  } catch (error) {
    throw new ApiError('Response body is not valid JSON.', {
      cause: error,
      status: response.status,
      url,
      body: rawBody,
    });
  }
};

export const apiClient = {
  get: <T>(url: string, options?: RequestOptions) => request<T>('GET', url, options),
  post: <T>(url: string, options?: RequestOptions) => request<T>('POST', url, options),
};
