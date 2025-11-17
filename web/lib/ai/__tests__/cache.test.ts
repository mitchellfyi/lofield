/**
 * Tests for AI cache module
 */

import { AICache, createCache } from "../cache";
import * as fs from "fs";

describe("AICache", () => {
  let cache: AICache<string>;
  const testCacheDir = "/tmp/lofield-test-cache";

  beforeEach(() => {
    // Create a fresh cache for each test
    cache = new AICache<string>("test", 60, true); // 60 second TTL
  });

  afterEach(() => {
    // Clean up
    cache.clear();
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  describe("Basic Operations", () => {
    it("should store and retrieve values", () => {
      cache.set("key1", "value1");
      const result = cache.get("key1");
      expect(result).toBe("value1");
    });

    it("should return null for non-existent keys", () => {
      const result = cache.get("nonexistent");
      expect(result).toBeNull();
    });

    it("should handle object keys", () => {
      const key = { prompt: "test", duration: 180 };
      cache.set(key, "value1");
      const result = cache.get(key);
      expect(result).toBe("value1");
    });

    it("should use consistent hashing for object keys", () => {
      const key1 = { prompt: "test", duration: 180 };
      const key2 = { prompt: "test", duration: 180 };
      cache.set(key1, "value1");
      const result = cache.get(key2);
      expect(result).toBe("value1");
    });
  });

  describe("Expiration", () => {
    it("should expire entries after TTL", async () => {
      const shortCache = new AICache<string>("test", 1, true); // 1 second TTL
      shortCache.set("key1", "value1");
      
      // Should exist immediately
      expect(shortCache.get("key1")).toBe("value1");
      
      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));
      
      // Should be expired
      expect(shortCache.get("key1")).toBeNull();
    });

    it("should clean up expired entries", async () => {
      const shortCache = new AICache<string>("test", 1, true);
      shortCache.set("key1", "value1");
      shortCache.set("key2", "value2");
      
      await new Promise((resolve) => setTimeout(resolve, 1100));
      
      const removed = shortCache.cleanup();
      expect(removed).toBe(2);
      expect(shortCache.getStats().size).toBe(0);
    });
  });

  describe("Statistics", () => {
    it("should track hits and misses", () => {
      cache.set("key1", "value1");
      
      cache.get("key1"); // hit
      cache.get("key1"); // hit
      cache.get("key2"); // miss
      cache.get("key3"); // miss
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });

    it("should track cache size", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");
      
      const stats = cache.getStats();
      expect(stats.size).toBe(3);
    });

    it("should calculate hit rate correctly", () => {
      cache.set("key1", "value1");
      cache.get("key1");
      cache.get("key1");
      cache.get("key1");
      
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(1.0);
    });
  });

  describe("Clear", () => {
    it("should clear all entries", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");
      
      cache.clear();
      
      expect(cache.getStats().size).toBe(0);
      expect(cache.get("key1")).toBeNull();
    });

    it("should reset statistics", () => {
      cache.set("key1", "value1");
      cache.get("key1");
      cache.get("key2");
      
      cache.clear();
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe("Disabled Cache", () => {
    it("should not cache when disabled", () => {
      const disabledCache = new AICache<string>("test", 60, false);
      disabledCache.set("key1", "value1");
      const result = disabledCache.get("key1");
      expect(result).toBeNull();
    });

    it("should count misses when disabled", () => {
      const disabledCache = new AICache<string>("test", 60, false);
      disabledCache.get("key1");
      disabledCache.get("key2");
      
      const stats = disabledCache.getStats();
      expect(stats.misses).toBe(2);
      expect(stats.hits).toBe(0);
    });
  });

  describe("Persistence", () => {
    it("should persist to disk when configured", () => {
      const persistCache = new AICache<string>("persist-test", 60, true, testCacheDir);
      persistCache.set("key1", "value1");
      
      // Check that file was created
      const files = fs.readdirSync(testCacheDir);
      const cacheFiles = files.filter((f) => f.startsWith("persist-test_"));
      expect(cacheFiles.length).toBeGreaterThan(0);
    });

    it("should load from disk on initialization", () => {
      // Create and populate cache
      const cache1 = new AICache<string>("persist-test", 60, true, testCacheDir);
      cache1.set("key1", "value1");
      cache1.set("key2", "value2");
      
      // Create new cache instance (should load from disk)
      const cache2 = new AICache<string>("persist-test", 60, true, testCacheDir);
      
      expect(cache2.get("key1")).toBe("value1");
      expect(cache2.get("key2")).toBe("value2");
    });

    it("should skip expired entries when loading from disk", async () => {
      const cache1 = new AICache<string>("persist-test", 1, true, testCacheDir);
      cache1.set("key1", "value1");
      
      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));
      
      // Create new cache instance
      const cache2 = new AICache<string>("persist-test", 1, true, testCacheDir);
      
      expect(cache2.get("key1")).toBeNull();
    });
  });

  describe("createCache factory", () => {
    it("should create cache with correct configuration", () => {
      const factoryCache = createCache<string>("factory-test", 120, true);
      factoryCache.set("key1", "value1");
      
      expect(factoryCache.get("key1")).toBe("value1");
    });
  });
});
