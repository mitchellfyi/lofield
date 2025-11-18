# AI Modules Documentation

This document provides comprehensive documentation for the AI modules that power Lofield FM's music generation, script generation, and text-to-speech capabilities.

## Overview

The AI modules consist of three main components:

1. **Music Generation**: Generates lofi music tracks from text prompts
2. **Script Generation**: Creates DJ scripts for presenter segments
3. **Text-to-Speech (TTS)**: Converts scripts to audio

Each module includes:

- Caching to prevent duplicate generation
- Retry logic with exponential backoff
- Error handling and fallback behavior
- Configurable providers and parameters

## Architecture

```
web/lib/ai/
├── types.ts              # Type definitions
├── config.ts             # Configuration management
├── cache.ts              # Caching layer
├── retry.ts              # Retry utility
├── music-generation.ts   # Music generation module
├── script-generation.ts  # Script generation module
├── tts.ts                # TTS module
├── index.ts              # Main exports
└── __tests__/            # Unit tests
```

## Installation

### Required Dependencies

The AI modules require the `replicate` package for music generation:

```bash
npm install replicate
```

OpenAI is already installed as a dependency.

### API Keys

Set the following environment variables:

```bash
# Music generation (Replicate)
REPLICATE_API_TOKEN=your_replicate_api_token

# Script generation and TTS (OpenAI)
OPENAI_API_KEY=your_openai_api_key

# Optional: ElevenLabs for higher quality TTS
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

## Configuration

### Environment Variables

All configuration is done through environment variables with sensible defaults.

#### Music Generation

```bash
# Provider: "replicate" or "custom"
MUSIC_PROVIDER=replicate

# Replicate model ID for MusicGen
MUSIC_MODEL=meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb

# Default track duration in seconds
MUSIC_DEFAULT_DURATION=180

# Enable/disable caching
MUSIC_CACHE_ENABLED=true

# Cache time-to-live in seconds (24 hours default)
MUSIC_CACHE_TTL=86400
```

#### Script Generation

```bash
# Provider: "openai" or "anthropic"
SCRIPT_PROVIDER=openai

# OpenAI model
SCRIPT_MODEL=gpt-4o-mini

# Temperature for script generation (0.0-2.0)
SCRIPT_TEMPERATURE=0.7

# Maximum tokens for script generation
SCRIPT_MAX_TOKENS=1000

# Enable/disable caching
SCRIPT_CACHE_ENABLED=true

# Cache time-to-live in seconds (1 hour default)
SCRIPT_CACHE_TTL=3600
```

#### Text-to-Speech

```bash
# Provider: "openai", "elevenlabs", or "google"
TTS_PROVIDER=openai

# Default voice ID (optional)
TTS_DEFAULT_VOICE=voice_1

# Enable/disable caching
TTS_CACHE_ENABLED=true

# Cache time-to-live in seconds (24 hours default)
TTS_CACHE_TTL=86400

# ElevenLabs voice stability (0.0-1.0)
TTS_STABILITY=0.5

# ElevenLabs similarity boost (0.0-1.0)
TTS_SIMILARITY_BOOST=0.75
```

#### Storage

```bash
# Path for storing generated audio files
AUDIO_STORAGE_PATH=/tmp/lofield/audio

# Path for cache files
CACHE_DIR=/tmp/lofield/cache
```

#### Retry Configuration

```bash
# Maximum retry attempts
RETRY_MAX_ATTEMPTS=3

# Base delay between retries in milliseconds
RETRY_BASE_DELAY=1000

# Maximum delay between retries in milliseconds
RETRY_MAX_DELAY=10000
```

## Usage

### Music Generation

```typescript
import { generateMusic } from "@/lib/ai";

const result = await generateMusic({
  prompt: "chill lofi beats for coding",
  duration: 180, // seconds
  bpm: 85,
  mood: ["calm", "focused"],
  tags: ["coding_session"],
});

if (result.success) {
  console.log("Generated track:", result.filePath);
  console.log("Metadata:", result.metadata);
} else {
  console.error("Generation failed:", result.error);
}
```

#### Music Generation Parameters

- `prompt` (required): Text description of the desired music
- `duration` (optional): Target duration in seconds (default: 180)
- `bpm` (optional): Target beats per minute
- `mood` (optional): Array of mood descriptors
- `tags` (optional): Metadata tags

#### Music Generation Result

```typescript
{
  success: boolean;
  filePath?: string;           // Path to generated audio file
  metadata?: {
    title: string;
    artist: string;
    duration: number;           // Actual duration
    bpm?: number;
    mood?: string[];
    tags?: string[];
    generatedAt: Date;
    model: string;
    prompt: string;
  };
  error?: string;
  cached?: boolean;            // Whether retrieved from cache
}
```

### Script Generation

```typescript
import { generateScript } from "@/lib/ai";

const result = await generateScript({
  segmentType: "track_intro",
  showStyle: "deep_work",
  presenterIds: ["presenter_1", "presenter_2"],
  trackInfo: {
    title: "Chill Beats",
    requester: "Alex",
    location: "Bristol",
  },
  contextInfo: {
    currentTime: new Date(),
    previousTrack: "Morning Vibes",
  },
  durationSeconds: 30,
});

if (result.success) {
  console.log("Script:", result.transcript);
  console.log("Metadata:", result.metadata);
}
```

#### Segment Types

- `track_intro`: 15-30 seconds, introduce upcoming track
- `segment`: 1-2 minutes, topical chat and banter
- `handover`: 5 minutes, transition between shows
- `ident`: 5-10 seconds, station identification

#### Show Styles

- `morning_commute`: Morning Commute (The Fictional One) - 6-9 AM
- `deep_work`: Deep Work (According to Calendar Blocks) - 9 AM-12 PM
- `lunch_club`: Lunch Club (Allegedly Social) - 12-3 PM
- `survival`: Survival Mode (Technically Still Operational) - 3-6 PM
- `commute`: Evening Commute (Another One) - 6-9 PM
- `night_school`: Night School (For People Who Read Documentation) - 9 PM-12 AM
- `night_shift`: Night Shift (For People Who Can't Sleep Anyway) - 12-3 AM
- `insomniac`: The Insomniac Sessions (Might As Well Be Productive) - 3-6 AM

#### Script Generation Result

```typescript
{
  success: boolean;
  transcript?: string;         // Generated script text
  metadata?: {
    segmentType: SegmentType;
    tone: "dry" | "reflective" | "humorous" | "matter-of-fact";
    tags: string[];
    estimatedDuration: number;
    presenterIds: string[];
    generatedAt: Date;
    model: string;
  };
  error?: string;
  cached?: boolean;
}
```

### Text-to-Speech

```typescript
import { generateTTS } from "@/lib/ai";

const result = await generateTTS({
  text: "That was 'Chill Beats' requested by Alex in Bristol.",
  voiceId: "voice_1",
  presenterName: "Presenter One",
  speed: 1.0,
  stability: 0.5, // ElevenLabs only
  similarityBoost: 0.75, // ElevenLabs only
});

if (result.success) {
  console.log("Audio file:", result.filePath);
  console.log("Duration:", result.metadata?.duration);
}
```

#### Voice IDs

For OpenAI TTS, use these generic voice IDs (mapped internally):

- `voice_1` → "alloy"
- `voice_2` → "echo"
- `voice_3` → "fable"
- `voice_4` → "onyx"
- `voice_5` → "nova"
- `voice_6` → "shimmer"

For ElevenLabs, use actual ElevenLabs voice IDs from your account.

#### TTS Result

```typescript
{
  success: boolean;
  filePath?: string;           // Path to generated audio file
  metadata?: {
    voiceId: string;
    presenterName?: string;
    duration: number;           // Estimated duration in seconds
    text: string;
    generatedAt: Date;
    provider: string;
    characterCount: number;
  };
  error?: string;
  cached?: boolean;
}
```

## Caching

All modules use a caching layer to prevent duplicate generation.

### Cache Behavior

- Cache keys are generated from input parameters
- Cached results are served immediately without API calls
- Cache entries expire based on TTL (configurable per module)
- Optional disk persistence for cache survival across restarts

### Cache Management

```typescript
import {
  getMusicCacheStats,
  getScriptCacheStats,
  getTTSCacheStats,
  clearMusicCache,
  clearScriptCache,
  clearTTSCache,
} from "@/lib/ai";

// Get statistics
const musicStats = getMusicCacheStats();
console.log(`Hit rate: ${musicStats.hitRate * 100}%`);

// Clear caches
clearMusicCache();
clearScriptCache();
clearTTSCache();
```

## Error Handling

All modules implement robust error handling:

1. **Input Validation**: Validates requests before API calls
2. **Retry Logic**: Automatically retries on transient failures
3. **Graceful Degradation**: Returns error results instead of throwing
4. **Error Details**: Provides detailed error messages for debugging

### Retryable Errors

The following errors trigger automatic retry:

- Network timeouts
- Rate limiting (429)
- Server errors (500, 502, 503, 504)
- Service unavailability

### Non-Retryable Errors

These errors fail immediately:

- Invalid API keys
- Validation errors
- Client errors (400, 401, 403, 404)

### Example Error Handling

```typescript
const result = await generateMusic({ prompt: "lofi beats" });

if (!result.success) {
  if (result.error?.includes("API_KEY")) {
    console.error("API key not configured");
    // Show user message about missing configuration
  } else if (result.error?.includes("rate limit")) {
    console.error("Rate limited, try again later");
    // Queue for retry
  } else {
    console.error("Generation failed:", result.error);
    // Use fallback content
  }
}
```

## Integration with Scheduler

The scheduler service uses these modules to generate content:

```typescript
// In services/scheduler/index.ts
import { generateMusic, generateScript, generateTTS } from "../../web/lib/ai";

// Generate music from request
const musicResult = await generateMusic({
  prompt: normalizedPrompt,
  duration: 180,
  tags: request.tags,
});

// Generate presenter script
const scriptResult = await generateScript({
  segmentType: "track_intro",
  showStyle: currentShow.style,
  presenterIds: currentShow.presenterIds,
  trackInfo: {
    title: musicResult.metadata?.title,
    requester: request.userName,
  },
});

// Convert script to audio
const ttsResult = await generateTTS({
  text: scriptResult.transcript!,
  voiceId: presenters[0].voiceId,
  presenterName: presenters[0].name,
});

// Create segments in database
await prisma.segment.create({
  data: {
    showId: currentShow.id,
    type: "music",
    filePath: musicResult.filePath!,
    // ... other fields
  },
});
```

## Testing

Unit tests are provided for all modules:

```bash
# Run all AI module tests
npm test -- lib/ai/__tests__

# Run specific test file
npm test -- lib/ai/__tests__/music-generation.test.ts

# Run with coverage
npm test -- --coverage lib/ai/__tests__
```

## Performance Considerations

### API Costs

- **Music Generation**: ~$0.002-0.01 per generation (Replicate pricing)
- **Script Generation**: ~$0.001-0.005 per script (OpenAI GPT-4o-mini)
- **TTS**: ~$0.015 per 1k characters (OpenAI TTS)

### Optimization Strategies

1. **Enable Caching**: Reduces duplicate API calls (enabled by default)
2. **Batch Processing**: Generate multiple segments at once when possible
3. **Pre-generation**: Generate content during low-usage periods
4. **Fallback Content**: Maintain a library of pre-generated content

### Expected Latency

- **Music Generation**: 30-60 seconds for 3-minute track
- **Script Generation**: 2-5 seconds
- **TTS**: 1-3 seconds per script

## Troubleshooting

### Common Issues

**"REPLICATE_API_TOKEN not set"**

- Ensure `REPLICATE_API_TOKEN` is set in your environment
- Get token from https://replicate.com/account

**"OPENAI_API_KEY not set"**

- Ensure `OPENAI_API_KEY` is set in your environment
- Get token from https://platform.openai.com/api-keys

**"Failed to download audio"**

- Check network connectivity
- Verify `AUDIO_STORAGE_PATH` is writable
- Check disk space

**"Rate limit exceeded"**

- Wait before retrying
- Increase `RETRY_BASE_DELAY` and `RETRY_MAX_DELAY`
- Consider upgrading API plan

**Cache not persisting**

- Verify `CACHE_DIR` is writable
- Check disk space
- Ensure process has file system permissions

## Security

### API Key Management

- **Never commit API keys to version control**
- Use environment variables or secrets management
- Rotate keys regularly
- Use separate keys for development and production

### Input Validation

All modules validate inputs before making API calls to prevent:

- Prompt injection
- Excessive resource usage
- Invalid parameters

### Content Safety

Script generation includes content policy guidelines:

- No health or medical advice
- No political content
- No cruel or mean-spirited humor
- No explicit content

## Future Enhancements

Potential improvements:

- [ ] Support for Anthropic Claude for script generation
- [ ] Custom music models fine-tuned on lofi datasets
- [ ] Voice cloning for unique presenter personalities
- [ ] Real-time streaming TTS
- [ ] Multi-language support
- [ ] Quality scoring and automatic regeneration
- [ ] A/B testing different prompts

## Seasonal and Holiday Integration

The AI modules support seasonal and holiday context to generate content that's relevant to the time of year. See the [Seasonal and Holiday Logic documentation](../../../docs/seasonal-holiday-logic.md) for complete details.

### Quick Example

```typescript
import {
  enhanceMusicRequestWithSeason,
  enhanceScriptRequestWithSeason,
} from "@/lib/seasonal";
import { generateMusic, generateScript } from "@/lib/ai";

// Music generation with seasonal bias
const musicRequest = {
  prompt: "chill lofi beats for studying",
  duration: 180,
};
const enhancedMusic = enhanceMusicRequestWithSeason(musicRequest);
const music = await generateMusic(enhancedMusic);
// In winter: adds "cosy winter atmosphere" to the prompt
// In summer: adds "bright and breezy" to the prompt

// Script generation with season and holiday context
const scriptRequest = {
  segmentType: "track_intro",
  showStyle: "mild_panic_mornings",
  presenterIds: ["morgan", "riley"],
  trackInfo: { title: "Morning Vibes" },
};
const enhancedScript = enhanceScriptRequestWithSeason(scriptRequest);
const script = await generateScript(enhancedScript);
// Adds contextInfo.season: "winter"
// Adds contextInfo.holidayTags: ["christmas_day"] on Dec 25
```

### Features

- **Season Detection**: Automatically detects current season (winter/spring/summer/autumn)
- **Holiday Detection**: Reads holidays from `config/tags.json`
- **Seasonal Mood Biases**: Each season has specific mood descriptors for music
- **Show Overrides**: Shows can define season-specific tone adjustments
- **Hemisphere Support**: Configurable for Northern or Southern hemisphere

See `docs/seasonal-holiday-logic.md` for:

- Complete API reference
- Usage examples
- Adding new holidays
- Customizing seasonal moods
- Integration guidelines

## Support

For issues or questions:

- Check the main [README](../../../README.md)
- Review [architecture documentation](../../../docs/architecture.md)
- Check [TESTING.md](../../../TESTING.md) for test guidelines
- Check [seasonal-holiday-logic.md](../../../docs/seasonal-holiday-logic.md) for seasonal features
- Open an issue on GitHub

---

_Lofield FM AI Modules: Making radio that's artificial and honest about it._
