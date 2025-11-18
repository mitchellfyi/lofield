/**
 * Text-to-Speech Adapter for Scheduler Service
 * 
 * Integrates with OpenAI TTS or ElevenLabs to convert presenter scripts to audio.
 * Supports voice assignment based on presenter configuration.
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import OpenAI from "openai";
import logger from "../logger";

// OpenAI client (lazy-loaded)
let openaiClient: OpenAI | null = null;

/**
 * Get or initialize OpenAI client
 */
function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY environment variable is not set. Please add OPENAI_API_KEY to your .env file. Get your API key from: https://platform.openai.com/api-keys"
    );
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return openaiClient;
}

// Map presenter voice IDs to OpenAI TTS voices
const OPENAI_VOICE_MAP: Record<
  string,
  "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"
> = {
  // Generic voice IDs (backwards compatibility)
  voice_1: "alloy",
  voice_2: "echo",
  voice_3: "fable",
  voice_4: "onyx",
  voice_5: "nova",
  voice_6: "shimmer",
  // Presenter-specific voice IDs mapped to OpenAI voices
  voice_alex_contemplative: "onyx",
  voice_sam_quiet: "echo",
  voice_jordan_gentle: "nova",
  voice_casey_calm: "shimmer",
  voice_morgan_resigned: "fable",
  voice_riley_practical: "alloy",
  voice_taylor_focused: "onyx",
  voice_drew_quiet: "echo",
  voice_avery_conversational: "nova",
  voice_reese_friendly: "shimmer",
  voice_quinn_determined: "fable",
  voice_sage_steady: "alloy",
  voice_rowan_relaxed: "echo",
  voice_finley_easygoing: "nova",
  voice_harper_calm: "shimmer",
  voice_river_thoughtful: "onyx",
};

/**
 * Generate TTS audio using OpenAI
 */
async function generateTTSWithOpenAI(
  text: string,
  voiceId: string,
  outputPath: string
): Promise<number> {
  const openai = getOpenAIClient();
  const openaiVoice = OPENAI_VOICE_MAP[voiceId] || "alloy";
  const ttsModel = process.env.TTS_MODEL || "tts-1";

  logger.debug(
    `  [TTS] Generating with OpenAI (model: ${ttsModel}, voice: ${openaiVoice} [${voiceId}])`
  );

  const mp3 = await openai.audio.speech.create({
    model: ttsModel as "tts-1" | "tts-1-hd",
    voice: openaiVoice,
    input: text,
    speed: 1.0,
  });

  // Save audio to file
  const arrayBuffer = await mp3.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.writeFile(outputPath, buffer);

  // Estimate duration (rough: ~150 words per minute)
  const wordCount = text.split(/\s+/).length;
  const estimatedDuration = Math.ceil((wordCount / 150) * 60);

  logger.debug(`  [TTS] Saved audio to ${outputPath} (~${estimatedDuration}s)`);
  return estimatedDuration;
}

/**
 * Generate TTS audio using ElevenLabs
 */
async function generateTTSWithElevenLabs(
  text: string,
  voiceId: string,
  outputPath: string
): Promise<number> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ELEVENLABS_API_KEY environment variable is not set. Please add ELEVENLABS_API_KEY to your .env file. Get your API key from: https://elevenlabs.io"
    );
  }

  logger.debug(`  [TTS] Generating with ElevenLabs (voice: ${voiceId})`);

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} ${errorText}`);
  }

  // Save audio to file
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.writeFile(outputPath, buffer);

  // Estimate duration
  const wordCount = text.split(/\s+/).length;
  const estimatedDuration = Math.ceil((wordCount / 150) * 60);

  logger.debug(`  [TTS] Saved audio to ${outputPath} (~${estimatedDuration}s)`);
  return estimatedDuration;
}

/**
 * Generate TTS audio for a text segment
 */
export async function generateTTS(
  text: string,
  voiceId: string,
  audioStoragePath: string
): Promise<{ filePath: string; duration: number }> {
  // Ensure storage directory exists
  await fs.mkdir(audioStoragePath, { recursive: true });

  // Generate filename
  const hash = crypto
    .createHash("md5")
    .update(text + voiceId)
    .digest("hex")
    .substring(0, 8);
  const timestamp = Date.now();
  const filename = `tts_${voiceId}_${timestamp}_${hash}.mp3`;
  const filePath = path.join(audioStoragePath, filename);

  // Select TTS provider
  const provider = process.env.TTS_PROVIDER || "openai";

  let duration: number;
  try {
    if (provider === "elevenlabs") {
      duration = await generateTTSWithElevenLabs(text, voiceId, filePath);
    } else {
      duration = await generateTTSWithOpenAI(text, voiceId, filePath);
    }

    return { filePath, duration };
  } catch (error) {
    logger.error({ err: error }, "  [ERROR] TTS generation failed");
    throw error;
  }
}
