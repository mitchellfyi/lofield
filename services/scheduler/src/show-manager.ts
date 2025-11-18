/**
 * Show Manager Module
 * 
 * Handles loading show configuration files from config/shows/*.json
 * and provides utilities for accessing show-specific settings.
 */

import * as fs from "fs/promises";
import * as path from "path";
import type { ShowConfig } from "./types";

// Cache for loaded show configurations
let showConfigCache: Map<string, ShowConfig> = new Map();
let configLoadTime: number = 0;

/**
 * Get the path to the config directory
 */
async function getConfigBasePath(): Promise<string> {
  // Try multiple possible paths (from scheduler service, from root, etc.)
  const possiblePaths = [
    path.join(process.cwd(), "..", "..", "config"),
    path.join(process.cwd(), "config"),
    path.join(__dirname, "..", "..", "..", "config"),
  ];

  for (const configPath of possiblePaths) {
    const showsPath = path.join(configPath, "shows");
    try {
      await fs.access(showsPath);
      return configPath;
    } catch {
      // Path doesn't exist, continue
    }
  }

  // Default to the most likely path
  return path.join(process.cwd(), "..", "..", "config");
}

/**
 * Load all show configurations from config/shows/*.json
 */
export async function loadShowConfigs(forceReload: boolean = false): Promise<Map<string, ShowConfig>> {
  const now = Date.now();
  
  // Return cached configs if recent (unless force reload)
  if (!forceReload && showConfigCache.size > 0 && (now - configLoadTime) < 60000) {
    return showConfigCache;
  }

  const configBasePath = await getConfigBasePath();
  const showsPath = path.join(configBasePath, "shows");

  try {
    await fs.access(showsPath);
  } catch {
    console.warn(`Shows config directory not found: ${showsPath}`);
    return new Map();
  }

  const newCache = new Map<string, ShowConfig>();
  const files = await fs.readdir(showsPath);

  for (const file of files) {
    if (!file.endsWith(".json")) {
      continue;
    }

    try {
      const filePath = path.join(showsPath, file);
      const content = await fs.readFile(filePath, "utf-8");
      const config: ShowConfig = JSON.parse(content);
      
      // Validate required fields
      if (!config.id || !config.name || !config.schedule || !config.ratios) {
        console.warn(`Invalid show config in ${file}: missing required fields`);
        continue;
      }

      newCache.set(config.id, config);
    } catch (error) {
      console.error(`Error loading show config ${file}:`, error);
    }
  }

  showConfigCache = newCache;
  configLoadTime = now;

  console.log(`Loaded ${newCache.size} show configurations`);
  return newCache;
}

/**
 * Get a specific show configuration by ID
 */
export async function getShowConfig(showId: string): Promise<ShowConfig | null> {
  const configs = await loadShowConfigs();
  return configs.get(showId) || null;
}

/**
 * Get all loaded show configurations
 */
export async function getAllShowConfigs(): Promise<ShowConfig[]> {
  const configs = await loadShowConfigs();
  return Array.from(configs.values());
}

/**
 * Reload configurations from disk
 * Useful for hot-reloading without service restart
 */
export async function reloadShowConfigs(): Promise<void> {
  console.log("Reloading show configurations...");
  await loadShowConfigs(true);
}

/**
 * Validate that a show config meets all requirements
 */
export function validateShowConfig(config: ShowConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check music/talk ratios
  if (config.ratios.music_fraction > 0.60) {
    errors.push(`Music fraction ${config.ratios.music_fraction} exceeds maximum 0.60`);
  }

  if (config.ratios.talk_fraction < 0.40) {
    errors.push(`Talk fraction ${config.ratios.talk_fraction} below minimum 0.40`);
  }

  const sumFractions = config.ratios.music_fraction + config.ratios.talk_fraction;
  if (Math.abs(sumFractions - 1.0) > 0.001) {
    errors.push(`Music + talk fractions = ${sumFractions}, must equal 1.0`);
  }

  // Check presenter duo size
  if (config.presenters.primary_duo.length !== 2) {
    errors.push(`Primary duo must have exactly 2 presenters, got ${config.presenters.primary_duo.length}`);
  }

  // Check probabilities
  const sumProb = config.presenters.duo_probability + config.presenters.solo_probability;
  if (Math.abs(sumProb - 1.0) > 0.001) {
    errors.push(`Duo + solo probability = ${sumProb}, must equal 1.0`);
  }

  // Check schedule duration
  if (config.schedule.duration_hours !== 3) {
    errors.push(`Duration must be 3 hours, got ${config.schedule.duration_hours}`);
  }

  // Check handover duration if present
  if (config.handover && config.handover.duration_seconds !== 300) {
    errors.push(`Handover duration must be 300 seconds, got ${config.handover.duration_seconds}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Deep merge utility to merge nested objects
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = target[key];
    
    if (sourceValue === undefined) {
      continue;
    }
    
    if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
      // For arrays, concatenate and deduplicate
      result[key] = [...new Set([...targetValue, ...sourceValue])] as any;
    } else if (
      typeof sourceValue === 'object' && 
      sourceValue !== null && 
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' && 
      targetValue !== null && 
      !Array.isArray(targetValue)
    ) {
      // For objects, recursively merge
      result[key] = deepMerge(targetValue, sourceValue) as any;
    } else {
      // For primitive values, override
      result[key] = sourceValue as any;
    }
  }
  
  return result;
}

/**
 * Get show configuration merged with seasonal/holiday overrides
 */
export async function getShowConfigWithOverrides(
  showId: string,
  season: string,
  holidayName?: string
): Promise<ShowConfig | null> {
  const baseConfig = await getShowConfig(showId);
  if (!baseConfig) {
    return null;
  }

  // Clone the config to avoid mutating the cache
  let config = JSON.parse(JSON.stringify(baseConfig)) as ShowConfig;

  // Apply seasonal overrides with deep merge
  if (config.season_overrides && config.season_overrides[season]) {
    const override = config.season_overrides[season];
    
    // Add additional topics to primary tags
    if (override.additional_topics) {
      config.topics.primary_tags = [
        ...config.topics.primary_tags,
        ...override.additional_topics,
      ];
    }
    
    // Deep merge other properties (like tone adjustments)
    if (override.tone_adjustment) {
      // Store tone_adjustment for prompt generation without overwriting existing tone
      config = deepMerge(config, {
        tone: {
          ...config.tone,
          seasonal_adjustment: override.tone_adjustment,
        } as any,
      });
    }
  }

  // Apply holiday overrides with deep merge
  if (holidayName && config.holiday_overrides) {
    for (const [key, override] of Object.entries(config.holiday_overrides)) {
      if (key.toLowerCase().includes(holidayName.toLowerCase())) {
        // Deep merge holiday adjustments
        if (override.tone_adjustment) {
          config = deepMerge(config, {
            tone: {
              ...config.tone,
              holiday_adjustment: override.tone_adjustment,
            } as any,
          });
        }
        break;
      }
    }
  }

  return config;
}

/**
 * Clear the configuration cache
 * Useful for testing
 */
export function clearShowConfigCache(): void {
  showConfigCache.clear();
  configLoadTime = 0;
}
