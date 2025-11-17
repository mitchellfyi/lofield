/**
 * Tests for retry utility
 */

import { withRetry, isRetryableError } from "../retry";

describe("Retry Utility", () => {
  describe("withRetry", () => {
    it("should succeed on first attempt", async () => {
      const fn = jest.fn().mockResolvedValue("success");
      
      const result = await withRetry(fn, {
        maxAttempts: 3,
        baseDelay: 100,
        maxDelay: 1000,
      });

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should retry on failure and eventually succeed", async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error("fail 1"))
        .mockRejectedValueOnce(new Error("fail 2"))
        .mockResolvedValue("success");
      
      const result = await withRetry(fn, {
        maxAttempts: 3,
        baseDelay: 10,
        maxDelay: 1000,
      });

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should throw error after max attempts", async () => {
      const fn = jest.fn().mockRejectedValue(new Error("persistent failure"));
      
      await expect(
        withRetry(fn, {
          maxAttempts: 3,
          baseDelay: 10,
          maxDelay: 1000,
        })
      ).rejects.toThrow("persistent failure");

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should use exponential backoff", async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error("fail 1"))
        .mockRejectedValueOnce(new Error("fail 2"))
        .mockResolvedValue("success");

      const onRetry = jest.fn();

      await withRetry(fn, {
        maxAttempts: 3,
        baseDelay: 100,
        maxDelay: 10000,
        onRetry,
      });

      // Should have called onRetry twice (once for each failure before success)
      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should respect max delay", async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error("fail 1"))
        .mockRejectedValueOnce(new Error("fail 2"))
        .mockResolvedValue("success");

      await withRetry(fn, {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 500, // Max delay is less than base * 2
      });

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should call onRetry callback", async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error("fail 1"))
        .mockResolvedValue("success");

      const onRetry = jest.fn();

      await withRetry(fn, {
        maxAttempts: 2,
        baseDelay: 10,
        maxDelay: 1000,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    });

    it("should not call onRetry on last attempt", async () => {
      const fn = jest.fn().mockRejectedValue(new Error("fail"));
      const onRetry = jest.fn();

      await expect(
        withRetry(fn, {
          maxAttempts: 2,
          baseDelay: 10,
          maxDelay: 1000,
          onRetry,
        })
      ).rejects.toThrow();

      // Should be called only once (after first failure, not after second)
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe("isRetryableError", () => {
    it("should identify network errors", () => {
      const error = new Error("Network timeout");
      expect(isRetryableError(error)).toBe(true);
    });

    it("should identify rate limit errors", () => {
      const error1 = new Error("Rate limit exceeded");
      const error2 = new Error("Error 429");
      
      expect(isRetryableError(error1)).toBe(true);
      expect(isRetryableError(error2)).toBe(true);
    });

    it("should identify server errors", () => {
      const errors = [
        new Error("500 Internal Server Error"),
        new Error("502 Bad Gateway"),
        new Error("503 Service Unavailable"),
        new Error("504 Gateway Timeout"),
      ];

      errors.forEach((error) => {
        expect(isRetryableError(error)).toBe(true);
      });
    });

    it("should identify unavailability errors", () => {
      const error1 = new Error("Service unavailable");
      const error2 = new Error("Server overload");
      
      expect(isRetryableError(error1)).toBe(true);
      expect(isRetryableError(error2)).toBe(true);
    });

    it("should not retry client errors", () => {
      const errors = [
        new Error("400 Bad Request"),
        new Error("401 Unauthorized"),
        new Error("403 Forbidden"),
        new Error("404 Not Found"),
      ];

      errors.forEach((error) => {
        expect(isRetryableError(error)).toBe(false);
      });
    });

    it("should not retry validation errors", () => {
      const error = new Error("Invalid input");
      expect(isRetryableError(error)).toBe(false);
    });

    it("should be case insensitive", () => {
      const error = new Error("NETWORK TIMEOUT");
      expect(isRetryableError(error)).toBe(true);
    });
  });
});
