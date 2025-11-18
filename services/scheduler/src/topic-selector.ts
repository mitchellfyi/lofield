/**
 * Topic Selector Module
 * 
 * Handles topic and mood selection for content generation,
 * incorporating seasonal and holiday context.
 */

import type { ShowConfig, SeasonalContext, TopicSelectionOptions } from "./types";

/**
 * Select topics for content generation based on show config and seasonal context
 */
export function selectTopics(options: TopicSelectionOptions): string[] {
  const { showConfig, seasonalContext, excludeTags = [], maxTags = 5 } = options;
  
  // Start with primary tags
  let availableTags = [...showConfig.topics.primary_tags];
  
  // Add seasonal tags if available
  availableTags = [...availableTags, ...seasonalContext.additionalTags];
  
  // Remove banned tags
  const bannedTags = showConfig.topics.banned_tags || [];
  availableTags = availableTags.filter(tag => !bannedTags.includes(tag));
  
  // Remove excluded tags
  availableTags = availableTags.filter(tag => !excludeTags.includes(tag));
  
  // Remove duplicates
  availableTags = [...new Set(availableTags)];
  
  // Shuffle and select up to maxTags
  const shuffled = shuffleArray(availableTags);
  return shuffled.slice(0, maxTags);
}

/**
 * Get mood keywords for music generation
 */
export function getMoodKeywords(showConfig: ShowConfig, seasonalContext: SeasonalContext): string[] {
  const keywords = [...showConfig.tone.keywords];
  
  // Add seasonal context if there's a tone adjustment
  if (seasonalContext.toneAdjustment) {
    // Extract keywords from tone adjustment (simple approach)
    const adjustmentWords = seasonalContext.toneAdjustment
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 4); // Only longer words
    
    keywords.push(...adjustmentWords.slice(0, 2));
  }
  
  return keywords;
}

/**
 * Select a sample line from commentary style examples
 */
export function selectSampleLine(showConfig: ShowConfig): string | null {
  if (!showConfig.commentary_style || !showConfig.commentary_style.sample_lines) {
    return null;
  }
  
  const lines = showConfig.commentary_style.sample_lines;
  if (lines.length === 0) {
    return null;
  }
  
  const index = Math.floor(Math.random() * lines.length);
  return lines[index];
}

/**
 * Select a check-in phrase
 */
export function selectCheckIn(showConfig: ShowConfig): string | null {
  if (!showConfig.commentary_style || !showConfig.commentary_style.check_ins) {
    return null;
  }
  
  const checkIns = showConfig.commentary_style.check_ins;
  if (checkIns.length === 0) {
    return null;
  }
  
  const index = Math.floor(Math.random() * checkIns.length);
  return checkIns[index];
}

/**
 * Determine if a longer segment should be generated
 */
export function shouldGenerateLongerSegment(frequency: string): boolean {
  const frequencyMap: Record<string, number> = {
    rare: 0.1,
    occasional: 0.25,
    regular: 0.4,
    frequent: 0.6,
  };
  
  const probability = frequencyMap[frequency.toLowerCase()] || 0.25;
  return Math.random() < probability;
}

/**
 * Get segment duration based on commentary style
 */
export function getSegmentDuration(showConfig: ShowConfig, isLonger: boolean = false): number {
  if (!showConfig.commentary_style) {
    return 30; // Default 30 seconds
  }
  
  if (isLonger) {
    return showConfig.commentary_style.longer_segment_length_seconds;
  }
  
  return showConfig.commentary_style.typical_intro_length_seconds;
}

/**
 * Get maximum link duration from timing config
 */
export function getMaxLinkDuration(showConfig: ShowConfig): number {
  return showConfig.timing.max_link_seconds;
}

/**
 * Get minimum gap between links
 */
export function getMinGapBetweenLinks(showConfig: ShowConfig): number {
  return showConfig.timing.min_gap_between_links_seconds;
}

/**
 * Get typical track length for scheduling
 */
export function getTypicalTrackLength(showConfig: ShowConfig): number {
  return showConfig.timing.typical_track_length_seconds || 210; // Default 3.5 minutes
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Build a prompt context for AI generation
 */
export function buildPromptContext(
  showConfig: ShowConfig,
  seasonalContext: SeasonalContext,
  includeExamples: boolean = true
): {
  showName: string;
  showMood: string;
  energyLevel: string;
  toneKeywords: string[];
  topics: string[];
  sampleLine?: string;
  seasonalNote?: string;
} {
  const topics = selectTopics({
    showConfig,
    seasonalContext,
    maxTags: 3,
  });
  
  const context: {
    showName: string;
    showMood: string;
    energyLevel: string;
    toneKeywords: string[];
    topics: string[];
    sampleLine?: string;
    seasonalNote?: string;
  } = {
    showName: showConfig.name,
    showMood: showConfig.tone.mood,
    energyLevel: showConfig.tone.energy_level,
    toneKeywords: showConfig.tone.keywords,
    topics,
  };
  
  if (includeExamples) {
    context.sampleLine = selectSampleLine(showConfig) || undefined;
  }
  
  if (seasonalContext.toneAdjustment) {
    context.seasonalNote = seasonalContext.toneAdjustment;
  }
  
  return context;
}

/**
 * Weight topic selection to encourage diversity
 * Tracks recently used topics and reduces their probability
 */
export class TopicDiversityTracker {
  private recentTopics: Map<string, number> = new Map();
  private maxHistory: number = 20;
  
  /**
   * Record that a topic was used
   */
  recordTopic(topic: string): void {
    const count = this.recentTopics.get(topic) || 0;
    this.recentTopics.set(topic, count + 1);
    
    // Trim history if too large
    if (this.recentTopics.size > this.maxHistory) {
      const entries = Array.from(this.recentTopics.entries());
      const firstKey = entries[0][0];
      this.recentTopics.delete(firstKey);
    }
  }
  
  /**
   * Get weight for a topic (lower for recently used topics)
   */
  getTopicWeight(topic: string): number {
    const count = this.recentTopics.get(topic) || 0;
    return 1.0 / (1.0 + count * 0.5);
  }
  
  /**
   * Select topics with diversity weighting
   */
  selectWeightedTopics(
    availableTopics: string[],
    count: number
  ): string[] {
    // Create weighted list
    const weighted = availableTopics.map(topic => ({
      topic,
      weight: this.getTopicWeight(topic),
    }));
    
    // Sort by weight (higher weight = less recently used)
    weighted.sort((a, b) => b.weight - a.weight);
    
    // Take top weighted topics with some randomization
    const selected: string[] = [];
    for (let i = 0; i < Math.min(count, weighted.length); i++) {
      // Probabilistically select from top weighted options
      const candidates = weighted.slice(i, Math.min(i + 3, weighted.length));
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      selected.push(chosen.topic);
      this.recordTopic(chosen.topic);
    }
    
    return selected;
  }
  
  /**
   * Clear history
   */
  clear(): void {
    this.recentTopics.clear();
  }
}
