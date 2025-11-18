/**
 * Retry utility with exponential backoff
 *
 * Provides robust retry logic for API calls.
 */

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number; // Base delay in ms
  maxDelay: number; // Max delay in ms
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on last attempt
      if (attempt === options.maxAttempts) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        options.baseDelay * Math.pow(2, attempt - 1),
        options.maxDelay
      );

      // Call retry callback if provided
      if (options.onRetry) {
        options.onRetry(attempt, lastError);
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("Unknown error during retry");
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Network errors
  if (message.includes("network") || message.includes("timeout")) {
    return true;
  }

  // Rate limiting
  if (message.includes("rate limit") || message.includes("429")) {
    return true;
  }

  // Server errors (5xx)
  if (
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504")
  ) {
    return true;
  }

  // Temporary unavailability
  if (message.includes("unavailable") || message.includes("overload")) {
    return true;
  }

  return false;
}
