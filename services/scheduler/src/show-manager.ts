/**
 * Show Manager Module
 * 
 * Handles loading show configuration files from config/shows/*.json
 * and provides utilities for accessing show-specific settings.
 */

import * as fs from "fs";
import * as path from "path";
import type { ShowConfig } from "./types";

// Cache for loaded show configurations
let showConfigCache: Map<string, ShowConfig> = new Map();
let configLoadTime: number = 0;

/**
 * Get the path to the config directory
 */
function getConfigBasePath(): string {
  // Try multiple possible paths (from scheduler service, from root, etc.)
  const possiblePaths = [
    path.join(process.cwd(), "..", "..", "config"),
    path.join(process.cwd(), "config"),
    path.join(__dirname, "..", "..", "..", "config"),
  ];

  for (const configPath of possiblePaths) {
    const showsPath = path.join(configPath, "shows");
    if (fs.existsSync(showsPath)) {
      return configPath;
    }
  }

  // Default to the most likely path
  return path.join(process.cwd(), "..", "..", "config");
}

/**
 * Load all show configurations from config/shows/*.json
 */
export function loadShowConfigs(forceReload: boolean = false): Map<string, ShowConfig> {
  const now = Date.now();
  
  // Return cached configs if recent (unless force reload)
  if (!forceReload && showConfigCache.size > 0 && (now - configLoadTime) < 60000) {
    return showConfigCache;
  }

  const configBasePath = getConfigBasePath();
  const showsPath = path.join(configBasePath, "shows");

  if (!fs.existsSync(showsPath)) {
    console.warn(`Shows config directory not found: ${showsPath}`);
    return new Map();
  }

  const newCache = new Map<string, ShowConfig>();
  const files = fs.readdirSync(showsPath);

  for (const file of files) {
    if (!file.endsWith(".json")) {
      continue;
    }

    try {
      const filePath = path.join(showsPath, file);
      const content = fs.readFileSync(filePath, "utf-8");
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
export function getShowConfig(showId: string): ShowConfig | null {
  const configs = loadShowConfigs();
  return configs.get(showId) || null;
}

/**
 * Get all loaded show configurations
 */
export function getAllShowConfigs(): ShowConfig[] {
  const configs = loadShowConfigs();
  return Array.from(configs.values());
}

/**
 * Reload configurations from disk
 * Useful for hot-reloading without service restart
 */
export function reloadShowConfigs(): void {
  console.log("Reloading show configurations...");
  loadShowConfigs(true);
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
 * Get show configuration merged with seasonal/holiday overrides
 */
export function getShowConfigWithOverrides(
  showId: string,
  season: string,
  holidayName?: string
): ShowConfig | null {
  const baseConfig = getShowConfig(showId);
  if (!baseConfig) {
    return null;
  }

  // Clone the config to avoid mutating the cache
  const config = JSON.parse(JSON.stringify(baseConfig)) as ShowConfig;

  // Apply seasonal overrides
  if (config.season_overrides && config.season_overrides[season]) {
    const override = config.season_overrides[season];
    
    // Add additional topics to primary tags
    if (override.additional_topics) {
      config.topics.primary_tags = [
        ...config.topics.primary_tags,
        ...override.additional_topics,
      ];
    }
  }

  // Apply holiday overrides
  if (holidayName && config.holiday_overrides) {
    for (const [key, override] of Object.entries(config.holiday_overrides)) {
      if (key.toLowerCase().includes(holidayName.toLowerCase())) {
        // Holiday overrides could add more topics in the future
        // For now, we just note they're available for prompt generation
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
