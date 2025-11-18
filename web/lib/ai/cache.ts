/**
 * Caching layer for AI module results
 *
 * Prevents duplicate generation for the same prompts/inputs.
 * Uses in-memory cache with optional file-based persistence.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import type { CacheEntry, CacheStats } from "./types";

export class AICache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
  };
  private persistDir?: string;

  constructor(
    private name: string,
    private ttl: number, // Time to live in seconds
    private enabled: boolean = true,
    persistDir?: string
  ) {
    this.persistDir = persistDir;
    if (this.persistDir && this.enabled) {
      this.loadFromDisk();
    }
  }

  /**
   * Generate a cache key from input data
   */
  private generateKey(input: string | object): string {
    const data = typeof input === "string" ? input : JSON.stringify(input);
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  /**
   * Get a value from cache
   */
  get(input: string | object): T | null {
    if (!this.enabled) {
      this.stats.misses++;
      return null;
    }

    const key = this.generateKey(input);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if entry has expired
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set a value in cache
   */
  set(
    input: string | object,
    value: T,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.enabled) {
      return;
    }

    const key = this.generateKey(input);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttl * 1000);

    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: now,
      expiresAt,
      metadata,
    };

    this.cache.set(key, entry);

    // Persist to disk if configured
    if (this.persistDir) {
      this.saveToDisk(key, entry);
    }
  }

  /**
   * Clear expired entries
   */
  cleanup(): number {
    const now = new Date();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.cache.delete(key);
        removed++;

        // Remove from disk if persisted
        if (this.persistDir) {
          this.removeFromDisk(key);
        }
      }
    }

    return removed;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };

    // Clear disk cache if configured
    if (this.persistDir) {
      try {
        if (fs.existsSync(this.persistDir)) {
          const files = fs.readdirSync(this.persistDir);
          for (const file of files) {
            if (file.startsWith(`${this.name}_`)) {
              fs.unlinkSync(path.join(this.persistDir, file));
            }
          }
        }
      } catch (error) {
        console.error(`Failed to clear disk cache for ${this.name}:`, error);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * Save a cache entry to disk
   */
  private saveToDisk(key: string, entry: CacheEntry<T>): void {
    if (!this.persistDir) return;

    try {
      // Ensure directory exists
      if (!fs.existsSync(this.persistDir)) {
        fs.mkdirSync(this.persistDir, { recursive: true });
      }

      const filename = path.join(this.persistDir, `${this.name}_${key}.json`);
      const data = JSON.stringify({
        ...entry,
        createdAt: entry.createdAt.toISOString(),
        expiresAt: entry.expiresAt?.toISOString(),
      });

      fs.writeFileSync(filename, data, "utf-8");
    } catch (error) {
      console.error(`Failed to save cache entry to disk:`, error);
    }
  }

  /**
   * Load cache from disk
   */
  private loadFromDisk(): void {
    if (!this.persistDir) return;

    try {
      if (!fs.existsSync(this.persistDir)) {
        return;
      }

      const files = fs.readdirSync(this.persistDir);
      const now = new Date();
      let loaded = 0;

      for (const file of files) {
        if (!file.startsWith(`${this.name}_`)) {
          continue;
        }

        try {
          const filename = path.join(this.persistDir, file);
          const data = fs.readFileSync(filename, "utf-8");
          const parsed = JSON.parse(data);

          // Convert ISO strings back to Dates
          const entry: CacheEntry<T> = {
            ...parsed,
            createdAt: new Date(parsed.createdAt),
            expiresAt: parsed.expiresAt
              ? new Date(parsed.expiresAt)
              : undefined,
          };

          // Skip expired entries
          if (entry.expiresAt && entry.expiresAt < now) {
            fs.unlinkSync(filename);
            continue;
          }

          this.cache.set(entry.key, entry);
          loaded++;
        } catch (error) {
          console.error(`Failed to load cache entry from ${file}:`, error);
        }
      }

      if (loaded > 0) {
        console.log(
          `Loaded ${loaded} cache entries for ${this.name} from disk`
        );
      }
    } catch (error) {
      console.error(`Failed to load cache from disk:`, error);
    }
  }

  /**
   * Remove a cache entry from disk
   */
  private removeFromDisk(key: string): void {
    if (!this.persistDir) return;

    try {
      const filename = path.join(this.persistDir, `${this.name}_${key}.json`);
      if (fs.existsSync(filename)) {
        fs.unlinkSync(filename);
      }
    } catch (error) {
      console.error(`Failed to remove cache entry from disk:`, error);
    }
  }
}

/**
 * Create a cache instance with configuration
 */
export function createCache<T>(
  name: string,
  ttl: number,
  enabled: boolean,
  persistDir?: string
): AICache<T> {
  return new AICache<T>(name, ttl, enabled, persistDir);
}
