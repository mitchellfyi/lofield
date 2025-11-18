/**
 * Content Generator Module
 * 
 * Integrates AI modules (music generation, script generation, TTS)
 * to create audio segments for the broadcast queue.
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import logger from "./logger";
import type { Show, ShowConfig, Request, Presenter } from "./types";
import { getShowConfig } from "./show-manager";
import { selectPresenters, getPresenterVoiceId, getPresenterDetails } from "./presenter-manager";
import { 
  selectTopics, 
  getMoodKeywords, 
  buildPromptContext,
  getSegmentDuration,
  shouldGenerateLongerSegment
} from "./topic-selector";
import { getSeasonalContextWithOverrides } from "./show-scheduler";
import { generateScript, splitScriptForDuo } from "./ai/script-generator";
import { generateTTS } from "./ai/tts-generator";
import { concatenateAudioFiles } from "./ai/audio-mixer";

interface MusicGenerationResult {
  success: boolean;
  filePath?: string;
  metadata?: {
    title: string;
    duration: number;
  };
  error?: string;
}

interface ScriptGenerationResult {
  success: boolean;
  transcript?: string;
  metadata?: {
    estimatedDuration: number;
  };
  error?: string;
}

interface TTSResult {
  success: boolean;
  filePath?: string;
  metadata?: {
    duration: number;
  };
  error?: string;
}

/**
 * Generate a music track from a request
 */
export async function generateMusicTrack(
  request: Request,
  show: Show,
  audioStoragePath: string
): Promise<MusicGenerationResult> {
  try {
    const showConfig = await getShowConfig(show.id);
    if (!showConfig) {
      throw new Error(`Show config not found for ${show.id}`);
    }

    const seasonalContext = getSeasonalContextWithOverrides(showConfig);
    const moodKeywords = getMoodKeywords(showConfig, seasonalContext);
    
    logger.debug(`  [AI] Generating music for request: "${request.rawText}"`);
    logger.debug(`  [AI] Mood keywords: ${moodKeywords.join(", ")}`);
    
    // In a real implementation, this would call the music generation AI
    // const result = await generateMusic({
    //   prompt: request.normalized || request.rawText,
    //   duration: 180,
    //   mood: moodKeywords,
    // });

    // Use show-specific track length or default to 3 minutes
    const trackDuration = showConfig.timing.typical_track_length_seconds || 180;

    // For stub: create a placeholder file path
    const filename = `track_${crypto.randomBytes(8).toString("hex")}.mp3`;
    const filePath = path.join(audioStoragePath, "music", filename);

    // Ensure directory exists
    const dir = path.dirname(filePath);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }

    // Create a stub file (in production, this would be the actual audio)
    await fs.writeFile(filePath, Buffer.from("stub_audio_data"));

    return {
      success: true,
      filePath,
      metadata: {
        title: request.rawText.substring(0, 50),
        duration: trackDuration,
      },
    };
  } catch (error) {
    logger.error({ err: error }, "  [ERROR] Music generation failed");
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Generate presenter commentary for a track
 */
export async function generateCommentary(
  request: Request | null,
  show: Show,
  trackTitle: string,
  audioStoragePath: string,
  segmentType: "track_intro" | "segment" = "track_intro"
): Promise<TTSResult> {
  try {
    const showConfig = await getShowConfig(show.id);
    if (!showConfig) {
      throw new Error(`Show config not found for ${show.id}`);
    }

    const seasonalContext = getSeasonalContextWithOverrides(showConfig);
    const { presenters, isDuo } = selectPresenters(
      showConfig.presenters.primary_duo,
      showConfig.presenters.duo_probability,
      show.id // Pass showId for usage tracking
    );

    // Determine segment duration
    const isLonger = showConfig.commentary_style 
      ? shouldGenerateLongerSegment(showConfig.commentary_style.longer_segment_frequency)
      : false;
    const targetDuration = getSegmentDuration(showConfig, isLonger);

    logger.debug(`  [AI] Generating ${isDuo ? 'duo' : 'solo'} ${segmentType} commentary for show: ${show.name}`);
    logger.debug(`  [AI] Presenters: ${presenters.join(", ")}, target duration: ${targetDuration}s`);

    // Get full presenter details for script generation
    const presenterDetails = await Promise.all(
      presenters.map((id) => getPresenterDetails(id))
    );
    const validPresenters = presenterDetails.filter((p): p is Presenter => p !== null);

    if (validPresenters.length === 0) {
      throw new Error("No valid presenters found");
    }

    // Step 1: Generate script with LLM
    const { script, estimatedDuration } = await generateScript({
      segmentType: segmentType,
      showConfig: showConfig,
      presenters: validPresenters,
      trackTitle: segmentType === "track_intro" ? trackTitle : undefined,
      request: request,
      topic: segmentType === "segment" ? selectTopics({ showConfig, seasonalContext })[0] : undefined,
      seasonalContext: {
        season: seasonalContext.season,
        holidayTags: seasonalContext.additionalTags,
      },
      targetDuration: targetDuration,
    });

    logger.debug(`  [AI] Generated script: "${script}"`);

    // Step 2: If duo, split script between presenters
    let audioSegments: { presenterId: string; text: string }[];
    if (isDuo && validPresenters.length > 1) {
      audioSegments = splitScriptForDuo(script, validPresenters);
    } else {
      audioSegments = [{ presenterId: validPresenters[0].id, text: script }];
    }

    // Step 3: Generate TTS for each segment
    const ttsStoragePath = path.join(audioStoragePath, "commentary");
    const audioFiles: { presenterId: string; filePath: string }[] = [];
    let totalDuration = 0;

    for (const segment of audioSegments) {
      const voiceId = await getPresenterVoiceId(segment.presenterId);
      if (!voiceId) {
        logger.warn(`  [WARN] Voice ID not found for presenter ${segment.presenterId}`);
        continue;
      }

      // Generate TTS audio
      const { filePath, duration } = await generateTTS(
        segment.text,
        voiceId,
        ttsStoragePath
      );

      audioFiles.push({ presenterId: segment.presenterId, filePath });
      totalDuration += duration;
    }

    // Step 4: Mix audio files if duo (concatenate sequentially)
    let finalFilePath: string;
    let finalDuration: number;

    if (audioFiles.length > 1) {
      // Mix all audio files into a single file
      const mixedFilename = `commentary_mixed_${crypto.randomBytes(8).toString("hex")}.mp3`;
      finalFilePath = path.join(ttsStoragePath, mixedFilename);
      
      finalDuration = await concatenateAudioFiles(
        audioFiles.map((f) => f.filePath),
        finalFilePath,
        0.3 // 0.3 second gap between presenters
      );
      
      logger.debug(`  [AI] Mixed ${audioFiles.length} audio segments into ${mixedFilename}`);
    } else if (audioFiles.length === 1) {
      finalFilePath = audioFiles[0].filePath;
      finalDuration = totalDuration;
    } else {
      throw new Error("No audio files generated");
    }

    return {
      success: true,
      filePath: finalFilePath,
      metadata: {
        duration: finalDuration,
      },
    };
  } catch (error) {
    logger.error({ err: error }, "  [ERROR] Commentary generation failed");
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Generate a handover segment between shows
 */
export async function generateHandoverSegment(
  currentShow: Show,
  nextShow: Show,
  audioStoragePath: string
): Promise<TTSResult> {
  try {
    const currentConfig = await getShowConfig(currentShow.id);
    const nextConfig = await getShowConfig(nextShow.id);
    
    if (!currentConfig || !nextConfig) {
      throw new Error("Show config not found for handover generation");
    }

    const outgoingPresenters = currentConfig.presenters.primary_duo;
    const incomingPresenters = nextConfig.presenters.primary_duo;
    const allPresenters = [...outgoingPresenters, ...incomingPresenters];

    const handoverDuration = currentConfig.handover?.duration_seconds || 300; // 5 minutes

    logger.debug(
      `  [AI] Generating handover from ${currentShow.name} to ${nextShow.name}`
    );
    logger.debug(`  [AI] Outgoing: ${outgoingPresenters.join(", ")}`);
    logger.debug(`  [AI] Incoming: ${incomingPresenters.join(", ")}`);

    // Get seasonal context for handover
    const seasonalContext = getSeasonalContextWithOverrides(currentConfig);
    
    // Build handover themes
    const handoverThemes = currentConfig.handover?.typical_themes || [];

    // Step 1: Generate witty handover script with Lofield voice
    // In production, this would call the LLM with proper context
    // const scriptResult = await generateScript({
    //   segmentType: "handover",
    //   showContext: {
    //     currentShow: currentConfig.name,
    //     nextShow: nextConfig.name,
    //     currentMood: currentConfig.tone.mood,
    //     nextMood: nextConfig.tone.mood,
    //     handoverThemes: handoverThemes,
    //     seasonalContext: seasonalContext,
    //   },
    //   presenterIds: allPresenters,
    //   durationSeconds: handoverDuration,
    //   isDuo: true, // Handovers are always multi-presenter
    // });

    // Generate a Lofield-style witty handover script (stub)
    const script = generateLofieldHandoverScript(
      currentShow.name,
      nextShow.name,
      currentConfig,
      nextConfig,
      handoverThemes
    );

    logger.debug(`  [AI] Generated handover script`);

    // Step 2: Split script among all presenters
    // For handovers, we want a conversation between all four
    const scriptSegments = splitHandoverScript(script, outgoingPresenters, incomingPresenters);

    // Step 3: Generate TTS for each presenter segment
    const ttsStoragePath = path.join(audioStoragePath, "handovers");
    const audioFiles: string[] = [];
    let totalDuration = 0;

    for (const segment of scriptSegments) {
      const voiceId = await getPresenterVoiceId(segment.presenterId);
      if (!voiceId) {
        logger.warn(`  [WARN] Voice ID not found for presenter ${segment.presenterId}`);
        continue;
      }

      // Generate TTS audio
      const { filePath, duration } = await generateTTS(
        segment.text,
        voiceId,
        ttsStoragePath
      );

      audioFiles.push(filePath);
      totalDuration += duration;
    }

    // Step 4: Mix/sequence all audio segments
    const mixedFilename = `handover_${crypto.randomBytes(8).toString("hex")}.mp3`;
    const filePath = path.join(ttsStoragePath, mixedFilename);
    
    // Mix all presenter audio files
    const finalDuration = await concatenateAudioFiles(audioFiles, filePath, 0.3);
    
    logger.debug(`  [AI] Mixed ${audioFiles.length} handover segments into ${mixedFilename}`);

    return {
      success: true,
      filePath,
      metadata: {
        duration: finalDuration,
      },
    };
  } catch (error) {
    logger.error({ err: error }, "  [ERROR] Handover generation failed");
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Generate a witty Lofield-style handover script
 */
function generateLofieldHandoverScript(
  currentShowName: string,
  nextShowName: string,
  currentConfig: ShowConfig,
  nextConfig: ShowConfig,
  themes: string[]
): string {
  // Generate dry, understated handover in Lofield style
  // This is a stub - in production, LLM would generate this
  
  const lines = [
    `And that's it for ${currentShowName}.`,
    `Hope you made it through.`,
    `Coming up next: ${nextShowName}.`,
    `Same frequency, different energy level.`,
    `We'll be here, you'll be there, time will continue to pass.`,
  ];
  
  // Add theme-specific line if available
  if (themes.length > 0) {
    const theme = themes[Math.floor(Math.random() * themes.length)];
    lines.push(`${theme}.`);
  }
  
  return lines.join(" ");
}

/**
 * Split handover script among outgoing and incoming presenters
 */
function splitHandoverScript(
  script: string,
  outgoingPresenters: string[],
  incomingPresenters: string[]
): { presenterId: string; text: string }[] {
  const sentences = script.split(/(?<=[.!?])\s+/);
  const lines: { presenterId: string; text: string }[] = [];
  
  // Distribute sentences alternating between outgoing and incoming
  // Pattern: outgoing anchor, outgoing sidekick, incoming anchor, incoming sidekick
  const presenterOrder = [
    ...outgoingPresenters,
    ...incomingPresenters,
  ];
  
  for (let i = 0; i < sentences.length; i++) {
    const presenterIndex = i % presenterOrder.length;
    lines.push({
      presenterId: presenterOrder[presenterIndex],
      text: sentences[i],
    });
  }
  
  return lines;
}

/**
 * Generate a station ident segment
 */
export async function generateIdent(
  show: Show,
  audioStoragePath: string
): Promise<TTSResult> {
  try {
    const showConfig = await getShowConfig(show.id);
    if (!showConfig) {
      throw new Error(`Show config not found for ${show.id}`);
    }

    logger.debug(`  [AI] Generating station ident for ${show.name}`);

    const { presenters } = selectPresenters(
      showConfig.presenters.primary_duo,
      0.5, // 50% chance of duo for idents
      show.id
    );

    // Get presenter details
    const presenterDetails = await Promise.all(
      presenters.map((id) => getPresenterDetails(id))
    );
    const validPresenters = presenterDetails.filter((p): p is Presenter => p !== null);

    if (validPresenters.length === 0) {
      throw new Error("No valid presenters found");
    }

    // Generate ident script
    const { script } = await generateScript({
      segmentType: "ident",
      showConfig: showConfig,
      presenters: validPresenters,
      targetDuration: 10,
    });

    // Generate TTS for the ident
    const voiceId = await getPresenterVoiceId(validPresenters[0].id);
    if (!voiceId) {
      throw new Error(`Voice ID not found for presenter ${validPresenters[0].id}`);
    }

    const ttsStoragePath = path.join(audioStoragePath, "idents");
    const { filePath, duration } = await generateTTS(script, voiceId, ttsStoragePath);

    return {
      success: true,
      filePath,
      metadata: {
        duration,
      },
    };
  } catch (error) {
    logger.error({ err: error }, "  [ERROR] Ident generation failed");
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Create fallback/stock content when AI fails
 */
export async function generateFallbackContent(
  type: "music" | "talk",
  audioStoragePath: string,
  duration?: number
): Promise<{ filePath: string; duration: number }> {
  logger.info(`  [FALLBACK] Generating fallback ${type} content`);

  const filename = `fallback_${type}_${crypto.randomBytes(8).toString("hex")}.mp3`;
  const filePath = path.join(audioStoragePath, "fallback", filename);

  // Ensure directory exists
  const dir = path.dirname(filePath);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }

  // Create a stub file
  await fs.writeFile(filePath, Buffer.from("stub_fallback_audio_data"));

  // Use provided duration or defaults
  const actualDuration = duration ?? (type === "music" ? 180 : 30);

  return {
    filePath,
    duration: actualDuration,
  };
}
