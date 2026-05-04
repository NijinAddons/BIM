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

const sanitizeHeadersForLog = (headers: Record<string, string>) => {
  if (!headers.Authorization) {
    return headers;
  }

  return {
    ...headers,
    Authorization: '[redacted]',
  };
};

const getFrappeErrorMessage = (body: string) => {
  if (!body) {
    return null;
  }

  try {
    const parsedBody = JSON.parse(body) as {
      _server_messages?: string;
      exc_type?: string;
      exception?: string;
      message?: string | Record<string, unknown>;
    };

    if (typeof parsedBody._server_messages === 'string' && parsedBody._server_messages) {
      try {
        const serverMessages = JSON.parse(parsedBody._server_messages) as string[];
        const firstMessage = serverMessages[0];

        if (typeof firstMessage === 'string' && firstMessage) {
          try {
            const parsedMessage = JSON.parse(firstMessage) as {message?: string};

            if (typeof parsedMessage.message === 'string' && parsedMessage.message.trim()) {
              return parsedMessage.message.trim();
            }
          } catch {
            return firstMessage;
          }
        }
      } catch {
        return parsedBody._server_messages;
      }
    }

    if (typeof parsedBody.message === 'string' && parsedBody.message.trim()) {
      return parsedBody.message.trim();
    }

    return parsedBody.exception ?? parsedBody.exc_type ?? null;
  } catch {
    return null;
  }
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
  const headers = {
    Accept: 'application/json',
    ...(options.body ? {'Content-Type': 'application/json'} : {}),
    ...options.headers,
  };

  logger.log(options.logLabel ? `${options.logLabel} request` : 'API request', {
    body: options.body ?? null,
    headers: sanitizeHeadersForLog(headers),
    method,
    url,
  });

  const response = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const contentType = response.headers.get('content-type') ?? 'unknown';
  const responseHeaders = Object.fromEntries(response.headers.entries());
  const rawBody = await response.text();

  logger.log(options.logLabel ?? 'API response', {
    url,
    status: response.status,
    ok: response.ok,
    contentType,
    headers: responseHeaders,
    body: rawBody,
  });

  if (!response.ok) {
    const frappeErrorMessage = getFrappeErrorMessage(rawBody);

    throw new ApiError(
      frappeErrorMessage ?? `Request failed with status ${response.status}`,
      {
      status: response.status,
      url,
      body: rawBody,
      },
    );
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
