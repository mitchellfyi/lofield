/**
 * Audio Utilities Module
 *
 * Provides utilities for audio file analysis and manipulation.
 * Uses ffprobe to extract accurate metadata from audio files.
 */

import ffmpeg from "fluent-ffmpeg";
import ffprobeStatic from "ffprobe-static";

// Configure fluent-ffmpeg to use the static ffprobe binary
ffmpeg.setFfprobePath(ffprobeStatic.path);

/**
 * Audio file metadata extracted from ffprobe
 */
export interface AudioMetadata {
  duration: number; // Duration in seconds
  bitRate?: number; // Bit rate in bits per second
  sampleRate?: number; // Sample rate in Hz
  channels?: number; // Number of audio channels
  codec?: string; // Audio codec name
  format?: string; // Container format
}

/**
 * Extract accurate metadata from an audio file using ffprobe
 *
 * @param filePath - Path to the audio file
 * @returns Promise resolving to audio metadata
 * @throws Error if ffprobe fails or file is invalid
 */
export async function getAudioMetadata(
  filePath: string
): Promise<AudioMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(
          new Error(`Failed to probe audio file: ${err.message}`)
        );
        return;
      }

      // Extract format information
      const format = metadata.format;
      if (!format) {
        reject(new Error("No format information found in audio file"));
        return;
      }

      // Find the audio stream
      const audioStream = metadata.streams?.find(
        (stream) => stream.codec_type === "audio"
      );

      if (!audioStream) {
        reject(new Error("No audio stream found in file"));
        return;
      }

      // Extract and return metadata
      const result: AudioMetadata = {
        duration: format.duration || 0,
        bitRate: format.bit_rate ? parseInt(format.bit_rate, 10) : undefined,
        sampleRate: audioStream.sample_rate
          ? parseInt(String(audioStream.sample_rate), 10)
          : undefined,
        channels: audioStream.channels,
        codec: audioStream.codec_name,
        format: format.format_name,
      };

      resolve(result);
    });
  });
}

/**
 * Get just the duration of an audio file in seconds
 *
 * @param filePath - Path to the audio file
 * @returns Promise resolving to duration in seconds
 * @throws Error if ffprobe fails or file is invalid
 */
export async function getAudioDuration(filePath: string): Promise<number> {
  const metadata = await getAudioMetadata(filePath);
  return metadata.duration;
}
