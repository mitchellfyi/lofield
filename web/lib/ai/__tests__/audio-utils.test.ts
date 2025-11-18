/**
 * Tests for audio utilities module
 */

import * as fs from "fs";
import * as path from "path";

// Mock ffprobe before importing the module
const mockFfprobe = jest.fn();
const mockSetFfprobePath = jest.fn();

jest.mock("fluent-ffmpeg", () => {
  return {
    __esModule: true,
    setFfprobePath: mockSetFfprobePath,
    ffprobe: mockFfprobe,
  };
});

jest.mock("ffprobe-static", () => ({
  __esModule: true,
  path: "/mock/path/to/ffprobe",
}));

// Import after mocks are set up
import { getAudioMetadata, getAudioDuration } from "../audio-utils";

describe("Audio Utilities Module", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAudioMetadata", () => {
    it("should extract metadata from a valid audio file", async () => {
      // Mock successful ffprobe response
      mockFfprobe.mockImplementation((filePath, callback) => {
        callback(null, {
          format: {
            duration: 180.5,
            bit_rate: "128000",
            format_name: "mp3",
          },
          streams: [
            {
              codec_type: "audio",
              codec_name: "mp3",
              sample_rate: "48000",
              channels: 2,
            },
          ],
        });
      });

      const metadata = await getAudioMetadata("/fake/path/audio.mp3");

      expect(metadata.duration).toBe(180.5);
      expect(metadata.bitRate).toBe(128000);
      expect(metadata.sampleRate).toBe(48000);
      expect(metadata.channels).toBe(2);
      expect(metadata.codec).toBe("mp3");
      expect(metadata.format).toBe("mp3");
    });

    it("should handle ffprobe errors", async () => {
      mockFfprobe.mockImplementation((filePath, callback) => {
        callback(new Error("File not found"), null);
      });

      await expect(getAudioMetadata("/invalid/file.mp3")).rejects.toThrow(
        "Failed to probe audio file"
      );
    });

    it("should handle files without format information", async () => {
      mockFfprobe.mockImplementation((filePath, callback) => {
        callback(null, {
          format: null,
          streams: [],
        });
      });

      await expect(getAudioMetadata("/invalid/file.mp3")).rejects.toThrow(
        "No format information found"
      );
    });

    it("should handle files without audio streams", async () => {
      mockFfprobe.mockImplementation((filePath, callback) => {
        callback(null, {
          format: {
            duration: 100,
          },
          streams: [
            {
              codec_type: "video",
              codec_name: "h264",
            },
          ],
        });
      });

      await expect(getAudioMetadata("/video/file.mp4")).rejects.toThrow(
        "No audio stream found"
      );
    });

    it("should handle optional metadata fields gracefully", async () => {
      mockFfprobe.mockImplementation((filePath, callback) => {
        callback(null, {
          format: {
            duration: 60,
            // Missing bit_rate and format_name
          },
          streams: [
            {
              codec_type: "audio",
              codec_name: "aac",
              // Missing sample_rate and channels
            },
          ],
        });
      });

      const metadata = await getAudioMetadata("/fake/path/audio.aac");

      expect(metadata.duration).toBe(60);
      expect(metadata.bitRate).toBeUndefined();
      expect(metadata.sampleRate).toBeUndefined();
      expect(metadata.channels).toBeUndefined();
      expect(metadata.codec).toBe("aac");
      expect(metadata.format).toBeUndefined();
    });
  });

  describe("getAudioDuration", () => {
    it("should return just the duration from metadata", async () => {
      mockFfprobe.mockImplementation((filePath, callback) => {
        callback(null, {
          format: {
            duration: 245.75,
            bit_rate: "128000",
            format_name: "mp3",
          },
          streams: [
            {
              codec_type: "audio",
              codec_name: "mp3",
              sample_rate: "48000",
              channels: 2,
            },
          ],
        });
      });

      const duration = await getAudioDuration("/fake/path/audio.mp3");

      expect(duration).toBe(245.75);
    });

    it("should propagate errors from getAudioMetadata", async () => {
      mockFfprobe.mockImplementation((filePath, callback) => {
        callback(new Error("Permission denied"), null);
      });

      await expect(getAudioDuration("/restricted/file.mp3")).rejects.toThrow(
        "Failed to probe audio file"
      );
    });

    it("should handle zero duration files", async () => {
      mockFfprobe.mockImplementation((filePath, callback) => {
        callback(null, {
          format: {
            duration: 0,
          },
          streams: [
            {
              codec_type: "audio",
              codec_name: "mp3",
            },
          ],
        });
      });

      const duration = await getAudioDuration("/empty/file.mp3");

      expect(duration).toBe(0);
    });

    it("should handle fractional durations accurately", async () => {
      mockFfprobe.mockImplementation((filePath, callback) => {
        callback(null, {
          format: {
            duration: 123.456789,
          },
          streams: [
            {
              codec_type: "audio",
              codec_name: "flac",
            },
          ],
        });
      });

      const duration = await getAudioDuration("/precise/file.flac");

      expect(duration).toBe(123.456789);
    });
  });
});
