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
import type { Show, ShowConfig, Request } from "./types";
import { getShowConfig } from "./show-manager";
import { selectPresenters, getPresenterVoiceId, splitScriptForDuo } from "./presenter-manager";
import { 
  selectTopics, 
  getMoodKeywords, 
  buildPromptContext,
  getSegmentDuration,
  shouldGenerateLongerSegment
} from "./topic-selector";
import { getSeasonalContextWithOverrides } from "./show-scheduler";

/**
 * Mix/concatenate multiple audio files into a single file
 * In production, this would use actual audio processing libraries
 */
async function mixAudioFiles(
  audioFiles: string[],
  outputPath: string
): Promise<void> {
  // In a real implementation, this would:
  // 1. Load all audio files
  // 2. Concatenate them sequentially
  // 3. Save to outputPath
  // For stub: combine file contents as placeholder
  
  const combinedContent = Buffer.concat(
    await Promise.all(
      audioFiles.map(async (file) => {
        try {
          return await fs.readFile(file);
        } catch {
          return Buffer.from("stub_audio_data");
        }
      })
    )
  );
  
  await fs.writeFile(outputPath, combinedContent);
}

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

    // Build prompt context
    const promptContext = buildPromptContext(showConfig, seasonalContext);

    // Step 1: Generate script with LLM
    // const scriptResult = await generateScript({
    //   segmentType: segmentType,
    //   showContext: promptContext,
    //   trackInfo: {
    //     title: trackTitle,
    //     requester: request?.userId ?? undefined,
    //   },
    //   presenterIds: presenters,
    //   durationSeconds: targetDuration,
    //   isDuo: isDuo,
    // });

    // Stub script for now
    const script = request
      ? `That was ${trackTitle}, requested by a listener. Hope you're enjoying it.`
      : `Coming up next: ${trackTitle}. Perfect for this time of day.`;

    logger.debug(`  [AI] Generated script: "${script}"`);

    // Step 2: If duo, split script between presenters
    let audioSegments: { presenterId: string; text: string }[];
    if (isDuo) {
      audioSegments = await splitScriptForDuo(script, presenters);
    } else {
      audioSegments = [{ presenterId: presenters[0], text: script }];
    }

    // Step 3: Generate TTS for each segment
    const audioFiles: string[] = [];
    for (const segment of audioSegments) {
      const voiceId = await getPresenterVoiceId(segment.presenterId);
      if (!voiceId) {
        logger.warn(`  [WARN] Voice ID not found for presenter ${segment.presenterId}`);
        continue;
      }

      // const ttsResult = await generateTTS({
      //   text: segment.text,
      //   voiceId: voiceId,
      //   presenterName: segment.presenterId,
      // });

      // For stub: create a placeholder file
      const filename = `commentary_${segment.presenterId}_${crypto.randomBytes(4).toString("hex")}.mp3`;
      const filePath = path.join(audioStoragePath, "commentary", filename);
      
      const dir = path.dirname(filePath);
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
      }
      
      await fs.writeFile(filePath, Buffer.from("stub_tts_audio_data"));
      audioFiles.push(filePath);
    }

    // Step 4: Mix audio files if duo (concatenate sequentially)
    let finalFilePath: string;
    if (audioFiles.length > 1) {
      // Mix all audio files into a single file
      const mixedFilename = `commentary_mixed_${crypto.randomBytes(8).toString("hex")}.mp3`;
      finalFilePath = path.join(audioStoragePath, "commentary", mixedFilename);
      await mixAudioFiles(audioFiles, finalFilePath);
      
      logger.debug(`  [AI] Mixed ${audioFiles.length} audio segments into ${mixedFilename}`);
    } else {
      finalFilePath = audioFiles[0] || path.join(
        audioStoragePath, 
        "commentary", 
        `fallback_${crypto.randomBytes(8).toString("hex")}.mp3`
      );
    }

    return {
      success: true,
      filePath: finalFilePath,
      metadata: {
        duration: targetDuration,
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
    const audioFiles: string[] = [];
    for (const segment of scriptSegments) {
      const voiceId = await getPresenterVoiceId(segment.presenterId);
      if (!voiceId) {
        logger.warn(`  [WARN] Voice ID not found for presenter ${segment.presenterId}`);
        continue;
      }

      // const ttsResult = await generateTTS({
      //   text: segment.text,
      //   voiceId: voiceId,
      //   presenterName: segment.presenterId,
      // });

      // For stub: create a placeholder file
      const filename = `handover_${segment.presenterId}_${crypto.randomBytes(4).toString("hex")}.mp3`;
      const filePath = path.join(audioStoragePath, "handovers", filename);
      
      const dir = path.dirname(filePath);
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
      }
      
      await fs.writeFile(filePath, Buffer.from("stub_handover_audio_data"));
      audioFiles.push(filePath);
    }

    // Step 4: Mix/sequence all audio segments
    const mixedFilename = `handover_${crypto.randomBytes(8).toString("hex")}.mp3`;
    const filePath = path.join(audioStoragePath, "handovers", mixedFilename);
    
    // Mix all presenter audio files
    await mixAudioFiles(audioFiles, filePath);
    
    logger.debug(`  [AI] Mixed ${audioFiles.length} handover segments into ${mixedFilename}`);

    return {
      success: true,
      filePath,
      metadata: {
        duration: handoverDuration,
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

    // Stub ident script
    const script = "You're listening to Lofield FM. Background noise for people just trying to make it through the day.";

    // Generate TTS for the ident
    const voiceId = await getPresenterVoiceId(presenters[0]);
    
    // const ttsResult = await generateTTS({
    //   text: script,
    //   voiceId: voiceId || "default_voice",
    //   presenterName: presenters[0],
    // });

    // For stub: create a placeholder file path
    const filename = `ident_${crypto.randomBytes(8).toString("hex")}.mp3`;
    const filePath = path.join(audioStoragePath, "idents", filename);

    // Ensure directory exists
    const dir = path.dirname(filePath);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }

    // Create a stub file
    await fs.writeFile(filePath, Buffer.from("stub_ident_audio_data"));

    return {
      success: true,
      filePath,
      metadata: {
        duration: 10, // 10 seconds
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
  audioStoragePath: string
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

  return {
    filePath,
    duration: type === "music" ? 180 : 30,
  };
}
