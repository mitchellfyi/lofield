/**
 * Presenter Manager Module
 * 
 * Handles loading presenter configurations, managing voice assignments,
 * and determining duo vs solo presentation logic.
 */

import * as fs from "fs";
import * as path from "path";
import type { Presenter, PresentersConfig } from "./types";

// Cache for loaded presenter configurations
let presentersConfigCache: PresentersConfig | null = null;
let presenterLoadTime: number = 0;

/**
 * Get the path to the config directory
 */
function getConfigBasePath(): string {
  const possiblePaths = [
    path.join(process.cwd(), "..", "..", "config"),
    path.join(process.cwd(), "config"),
    path.join(__dirname, "..", "..", "..", "config"),
  ];

  for (const configPath of possiblePaths) {
    const presentersPath = path.join(configPath, "presenters.json");
    if (fs.existsSync(presentersPath)) {
      return configPath;
    }
  }

  return path.join(process.cwd(), "..", "..", "config");
}

/**
 * Load presenters configuration from config/presenters.json
 */
export function loadPresentersConfig(forceReload: boolean = false): PresentersConfig {
  const now = Date.now();
  
  // Return cached config if recent (unless force reload)
  if (!forceReload && presentersConfigCache && (now - presenterLoadTime) < 60000) {
    return presentersConfigCache;
  }

  const configBasePath = getConfigBasePath();
  const presentersPath = path.join(configBasePath, "presenters.json");

  if (!fs.existsSync(presentersPath)) {
    console.warn(`Presenters config not found: ${presentersPath}`);
    return { presenters: [] };
  }

  try {
    const content = fs.readFileSync(presentersPath, "utf-8");
    const config: PresentersConfig = JSON.parse(content);
    
    presentersConfigCache = config;
    presenterLoadTime = now;
    
    console.log(`Loaded ${config.presenters.length} presenter configurations`);
    return config;
  } catch (error) {
    console.error("Error loading presenters config:", error);
    return { presenters: [] };
  }
}

/**
 * Get a specific presenter by ID
 */
export function getPresenter(presenterId: string): Presenter | null {
  const config = loadPresentersConfig();
  return config.presenters.find(p => p.id === presenterId) || null;
}

/**
 * Get all presenters
 */
export function getAllPresenters(): Presenter[] {
  const config = loadPresentersConfig();
  return config.presenters;
}

/**
 * Get presenters for a specific show
 */
export function getPresentersForShow(showId: string): Presenter[] {
  const config = loadPresentersConfig();
  return config.presenters.filter(p => p.shows.includes(showId));
}

/**
 * Get a mapping of presenter IDs to their voice IDs
 */
export function getPresenterVoiceMap(): Record<string, string> {
  const config = loadPresentersConfig();
  const voiceMap: Record<string, string> = {};
  
  for (const presenter of config.presenters) {
    voiceMap[presenter.id] = presenter.voice_id;
  }
  
  return voiceMap;
}

/**
 * Get voice ID for a specific presenter
 */
export function getPresenterVoiceId(presenterId: string): string | null {
  const presenter = getPresenter(presenterId);
  return presenter ? presenter.voice_id : null;
}

/**
 * Determine if a segment should be duo or solo based on probability
 */
export function shouldBeDuo(duoProbability: number): boolean {
  return Math.random() < duoProbability;
}

/**
 * Select which presenter(s) to use for a segment
 */
export function selectPresenters(
  primaryDuo: string[],
  duoProbability: number
): { presenters: string[]; isDuo: boolean } {
  const isDuo = shouldBeDuo(duoProbability);
  
  if (isDuo) {
    return {
      presenters: primaryDuo,
      isDuo: true,
    };
  } else {
    // For solo, randomly pick one of the duo
    const selectedPresenter = primaryDuo[Math.floor(Math.random() * primaryDuo.length)];
    return {
      presenters: [selectedPresenter],
      isDuo: false,
    };
  }
}

/**
 * Get anchor and sidekick from a duo
 */
export function getAnchorAndSidekick(presenterIds: string[]): {
  anchor: Presenter | null;
  sidekick: Presenter | null;
} {
  const presenters = presenterIds.map(id => getPresenter(id)).filter(p => p !== null) as Presenter[];
  
  const anchor = presenters.find(p => p.role === "anchor") || null;
  const sidekick = presenters.find(p => p.role === "sidekick") || null;
  
  return { anchor, sidekick };
}

/**
 * Format presenter names for display
 */
export function formatPresenterNames(presenterIds: string[]): string {
  const presenters = presenterIds.map(id => getPresenter(id)).filter(p => p !== null) as Presenter[];
  
  if (presenters.length === 0) {
    return "Unknown";
  }
  
  if (presenters.length === 1) {
    return presenters[0].name;
  }
  
  return presenters.map(p => p.name).join(" & ");
}

/**
 * Split a script into lines for multiple presenters
 * This is a simple implementation that splits by sentences
 * More sophisticated parsing could be added later
 */
export function splitScriptForDuo(
  script: string,
  presenterIds: string[]
): { presenterId: string; text: string }[] {
  if (presenterIds.length === 1) {
    return [{ presenterId: presenterIds[0], text: script }];
  }

  const { anchor, sidekick } = getAnchorAndSidekick(presenterIds);
  
  // Split by sentences (simple approach)
  const sentences = script.split(/(?<=[.!?])\s+/);
  const lines: { presenterId: string; text: string }[] = [];
  
  // Alternate between presenters, anchor gets more lines
  for (let i = 0; i < sentences.length; i++) {
    const presenter = (i === 0 || i % 3 !== 2) && anchor ? anchor : sidekick;
    if (presenter) {
      lines.push({
        presenterId: presenter.id,
        text: sentences[i],
      });
    }
  }
  
  return lines;
}

/**
 * Reload presenters configuration from disk
 */
export function reloadPresentersConfig(): void {
  console.log("Reloading presenters configuration...");
  loadPresentersConfig(true);
}

/**
 * Clear the configuration cache
 * Useful for testing
 */
export function clearPresenterConfigCache(): void {
  presentersConfigCache = null;
  presenterLoadTime = 0;
}
