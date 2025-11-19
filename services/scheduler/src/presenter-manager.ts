/**
 * Presenter Manager Module
 *
 * Handles loading presenter configurations, managing voice assignments,
 * and determining duo vs solo presentation logic.
 */

import * as fs from "fs/promises";
import * as path from "path";
import type { Presenter, PresentersConfig } from "./types";

// Cache for loaded presenter configurations
let presentersConfigCache: PresentersConfig | null = null;
let presenterLoadTime: number = 0;

// Presenter usage tracking for fair rotation
interface PresenterUsage {
  [showId: string]: {
    [presenterId: string]: number; // Count of solo segments
  };
}

let presenterUsageTracking: PresenterUsage = {};

/**
 * Get the path to the config directory
 */
async function getConfigBasePath(): Promise<string> {
  const possiblePaths = [
    path.join(process.cwd(), "..", "..", "config"),
    path.join(process.cwd(), "config"),
    path.join(__dirname, "..", "..", "..", "config"),
  ];

  for (const configPath of possiblePaths) {
    const presentersPath = path.join(configPath, "presenters.json");
    try {
      await fs.access(presentersPath);
      return configPath;
    } catch {
      // Path doesn't exist, continue
    }
  }

  return path.join(process.cwd(), "..", "..", "config");
}

/**
 * Load presenters configuration from config/presenters.json
 */
export async function loadPresentersConfig(
  forceReload: boolean = false
): Promise<PresentersConfig> {
  const now = Date.now();

  // Return cached config if recent (unless force reload)
  if (
    !forceReload &&
    presentersConfigCache &&
    now - presenterLoadTime < 60000
  ) {
    return presentersConfigCache;
  }

  const configBasePath = await getConfigBasePath();
  const presentersPath = path.join(configBasePath, "presenters.json");

  try {
    await fs.access(presentersPath);
  } catch {
    console.warn(`Presenters config not found: ${presentersPath}`);
    return { presenters: [] };
  }

  try {
    const content = await fs.readFile(presentersPath, "utf-8");
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
export async function getPresenter(
  presenterId: string
): Promise<Presenter | null> {
  const config = await loadPresentersConfig();
  return config.presenters.find((p) => p.id === presenterId) || null;
}

/**
 * Alias for getPresenter - returns full presenter details
 */
export async function getPresenterDetails(
  presenterId: string
): Promise<Presenter | null> {
  return getPresenter(presenterId);
}

/**
 * Get all presenters
 */
export async function getAllPresenters(): Promise<Presenter[]> {
  const config = await loadPresentersConfig();
  return config.presenters;
}

/**
 * Get presenters for a specific show
 */
export async function getPresentersForShow(
  showId: string
): Promise<Presenter[]> {
  const config = await loadPresentersConfig();
  return config.presenters.filter((p) => p.shows.includes(showId));
}

/**
 * Get a mapping of presenter IDs to their voice IDs
 */
export async function getPresenterVoiceMap(): Promise<Record<string, string>> {
  const config = await loadPresentersConfig();
  const voiceMap: Record<string, string> = {};

  for (const presenter of config.presenters) {
    voiceMap[presenter.id] = presenter.voice_id;
  }

  return voiceMap;
}

/**
 * Get voice ID for a specific presenter
 */
export async function getPresenterVoiceId(
  presenterId: string
): Promise<string | null> {
  const presenter = await getPresenter(presenterId);
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
 * Tracks usage to ensure fair rotation for solo segments
 */
export function selectPresenters(
  primaryDuo: string[],
  duoProbability: number,
  showId?: string
): { presenters: string[]; isDuo: boolean } {
  const isDuo = shouldBeDuo(duoProbability);

  if (isDuo) {
    return {
      presenters: primaryDuo,
      isDuo: true,
    };
  } else {
    // For solo, rotate fairly between duo members
    if (showId && primaryDuo.length === 2) {
      // Initialize usage tracking for this show if needed
      if (!presenterUsageTracking[showId]) {
        presenterUsageTracking[showId] = {};
      }

      const usage = presenterUsageTracking[showId];
      const [presenter1, presenter2] = primaryDuo;

      // Initialize counts if needed
      if (usage[presenter1] === undefined) usage[presenter1] = 0;
      if (usage[presenter2] === undefined) usage[presenter2] = 0;

      // Select the presenter with fewer solo segments
      let selectedPresenter: string;
      if (usage[presenter1] < usage[presenter2]) {
        selectedPresenter = presenter1;
      } else if (usage[presenter2] < usage[presenter1]) {
        selectedPresenter = presenter2;
      } else {
        // If equal, randomly pick one
        selectedPresenter =
          primaryDuo[Math.floor(Math.random() * primaryDuo.length)];
      }

      // Increment usage count
      usage[selectedPresenter]++;

      return {
        presenters: [selectedPresenter],
        isDuo: false,
      };
    } else {
      // Fallback to random selection if no showId provided
      const selectedPresenter =
        primaryDuo[Math.floor(Math.random() * primaryDuo.length)];
      return {
        presenters: [selectedPresenter],
        isDuo: false,
      };
    }
  }
}

/**
 * Get anchor and sidekick from a duo
 */
export async function getAnchorAndSidekick(presenterIds: string[]): Promise<{
  anchor: Presenter | null;
  sidekick: Presenter | null;
}> {
  const presenters = await Promise.all(
    presenterIds.map((id) => getPresenter(id))
  );
  const validPresenters = presenters.filter((p) => p !== null) as Presenter[];

  const anchor = validPresenters.find((p) => p.role === "anchor") || null;
  const sidekick = validPresenters.find((p) => p.role === "sidekick") || null;

  return { anchor, sidekick };
}

/**
 * Format presenter names for display
 */
export async function formatPresenterNames(
  presenterIds: string[]
): Promise<string> {
  const presenters = await Promise.all(
    presenterIds.map((id) => getPresenter(id))
  );
  const validPresenters = presenters.filter((p) => p !== null) as Presenter[];

  if (validPresenters.length === 0) {
    return "Unknown";
  }

  if (validPresenters.length === 1) {
    return validPresenters[0].name;
  }

  return validPresenters.map((p) => p.name).join(" & ");
}

/**
 * Split a script into lines for multiple presenters
 * This is a simple implementation that splits by sentences
 * More sophisticated parsing could be added later
 */
export async function splitScriptForDuo(
  script: string,
  presenterIds: string[]
): Promise<{ presenterId: string; text: string }[]> {
  if (presenterIds.length === 1) {
    return [{ presenterId: presenterIds[0], text: script }];
  }

  const { anchor, sidekick } = await getAnchorAndSidekick(presenterIds);

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
export async function reloadPresentersConfig(): Promise<void> {
  console.log("Reloading presenters configuration...");
  await loadPresentersConfig(true);
}

/**
 * Clear the configuration cache
 * Useful for testing
 */
export function clearPresenterConfigCache(): void {
  presentersConfigCache = null;
  presenterLoadTime = 0;
}

/**
 * Get presenter usage statistics for a show
 * Useful for testing and monitoring fair rotation
 */
export function getPresenterUsage(showId: string): Record<string, number> {
  return presenterUsageTracking[showId] || {};
}

/**
 * Reset presenter usage tracking
 * Useful for testing
 */
export function resetPresenterUsage(showId?: string): void {
  if (showId) {
    delete presenterUsageTracking[showId];
  } else {
    presenterUsageTracking = {};
  }
}
