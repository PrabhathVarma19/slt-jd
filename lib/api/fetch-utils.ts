/**
 * Industry-standard fetch utilities with retry logic and proper error handling
 */

export interface FetchOptions extends RequestInit {
  retries?: number;
  retryDelay?: number | ((attemptIndex: number) => number);
  timeout?: number;
}

export interface FetchResponse<T = any> {
  data: T;
  response: Response;
}

/**
 * Calculate retry delay with exponential backoff
 */
function calculateRetryDelay(
  attemptIndex: number,
  baseDelay: number | ((attemptIndex: number) => number)
): number {
  if (typeof baseDelay === 'function') {
    return baseDelay(attemptIndex);
  }
  return baseDelay * Math.pow(2, attemptIndex);
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: any, response?: Response): boolean {
  // Network errors are retryable
  if (!response) return true;
  
  // 5xx errors are retryable (server errors)
  if (response.status >= 500) return true;
  
  // 408 Request Timeout is retryable
  if (response.status === 408) return true;
  
  // 429 Too Many Requests is retryable
  if (response.status === 429) return true;
  
  // 4xx client errors are NOT retryable (except 408, 429)
  if (response.status >= 400 && response.status < 500) return false;
  
  return false;
}

/**
 * Fetch with automatic retry logic and proper error handling
 * 
 * @param url - The URL to fetch
 * @param options - Fetch options including retry configuration
 * @returns Promise resolving to data and response
 * @throws Error if all retries fail or non-retryable error occurs
 * 
 * @example
 * ```typescript
 * const { data } = await fetchWithRetry('/api/auth/session', {
 *   retries: 2,
 *   credentials: 'include',
 * });
 * ```
 */
export async function fetchWithRetry<T = any>(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResponse<T>> {
  const {
    retries = 2,
    retryDelay = 500,
    timeout = 30000, // 30 seconds default timeout
    ...fetchOptions
  } = options;

  let lastError: any;
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = timeout
        ? setTimeout(() => controller.abort(), timeout)
        : null;

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        });

        // Clear timeout if request completed
        if (timeoutId) clearTimeout(timeoutId);

        // Check if response is OK
        if (!response.ok) {
          lastResponse = response;
          
          // Don't retry on client errors (4xx) except 408, 429
          if (!isRetryableError(null, response)) {
            // Try to parse error message from response
            let errorMessage = `Request failed with status ${response.status}`;
            try {
              const errorData = await response.json().catch(() => null);
              if (errorData?.error) {
                errorMessage = errorData.error;
              }
            } catch {
              // Ignore JSON parsing errors
            }
            throw new Error(errorMessage);
          }

          // Retryable error - continue to retry logic
          lastError = new Error(`Request failed with status ${response.status}`);
          
          // If this is the last attempt, throw the error
          if (attempt === retries) {
            throw lastError;
          }
        } else {
          // Success - parse and return data
          const data = await response.json();
          return { data, response };
        }
      } catch (error: any) {
        // Clear timeout if error occurred
        if (timeoutId) clearTimeout(timeoutId);

        // Abort errors are timeout errors
        if (error.name === 'AbortError') {
          lastError = new Error('Request timeout');
          if (attempt === retries) throw lastError;
        } else {
          throw error; // Re-throw non-timeout errors
        }
      }
    } catch (error: any) {
      lastError = error;
      
      // Don't retry if it's not a retryable error
      if (!isRetryableError(error, lastResponse)) {
        throw error;
      }

      // If this is the last attempt, throw the error
      if (attempt === retries) {
        throw lastError;
      }

      // Wait before retrying with exponential backoff
      const delay = calculateRetryDelay(attempt, retryDelay);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Unknown error occurred');
}

/**
 * Simplified fetch wrapper that automatically handles JSON parsing and errors
 * 
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @returns Promise resolving to parsed JSON data
 * 
 * @example
 * ```typescript
 * const data = await safeFetch('/api/auth/session');
 * ```
 */
export async function safeFetch<T = any>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { data } = await fetchWithRetry<T>(url, options);
  return data;
}

/**
 * Fetch wrapper specifically for authenticated API calls
 * Automatically includes credentials and proper headers
 */
export async function authenticatedFetch<T = any>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  return safeFetch<T>(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}
