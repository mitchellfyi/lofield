# AI Module Integration

This directory contains the AI integration modules for the Lofield FM scheduler service.

## Overview

The AI modules integrate with external providers to generate authentic presenter commentary and audio:

- **Script Generation** (`script-generator.ts`) - LLM-based script generation using OpenAI GPT-4
- **Text-to-Speech** (`tts-generator.ts`) - Voice synthesis using OpenAI TTS or ElevenLabs
- **Audio Mixing** (`audio-mixer.ts`) - FFmpeg-based audio concatenation for duo segments

## Features

### Script Generation

- Context-aware prompt building with:
  - Show configuration (mood, energy, tone)
  - Presenter personas and quirks
  - Seasonal context and holiday tags
  - Listener request metadata
- In-memory caching (1-hour TTL)
- Automatic duo presenter script splitting
- Lofield FM voice guidelines enforcement

### Text-to-Speech

- Dual provider support (OpenAI TTS / ElevenLabs)
- Presenter voice ID mapping
- Actual audio duration detection
- Automatic storage management

### Audio Mixing

- FFmpeg concat demuxer for efficient mixing
- Configurable gaps between segments
- Fallback to simple concatenation if FFmpeg unavailable
- Accurate duration extraction with FFprobe

## Usage

### Script Generation

```typescript
import { generateScript } from "./ai/script-generator";

const { script, estimatedDuration } = await generateScript({
  segmentType: "track_intro",
  showConfig: showConfig,
  presenters: [presenter1, presenter2],
  trackTitle: "Rainfall on a Tuesday",
  request: request,
  seasonalContext: { season: "winter", holidayTags: ["new-year"] },
  targetDuration: 30,
});
```

### Text-to-Speech

```typescript
import { generateTTS } from "./ai/tts-generator";

const { filePath, duration } = await generateTTS(
  "That was Rainfall on a Tuesday.",
  "voice_alex_contemplative",
  "/tmp/lofield/audio/commentary"
);
```

### Audio Mixing

```typescript
import { concatenateAudioFiles } from "./ai/audio-mixer";

const duration = await concatenateAudioFiles(
  ["audio1.mp3", "audio2.mp3"],
  "output.mp3",
  0.3 // 0.3 second gap
);
```

## Configuration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...

# Optional
SCRIPT_MODEL=gpt-4o-mini  # or gpt-4
TTS_PROVIDER=openai       # or elevenlabs
TTS_MODEL=tts-1           # or tts-1-hd
ELEVENLABS_API_KEY=...    # if using ElevenLabs
```

### Voice Mapping

Presenter voice IDs are mapped to TTS provider voices in `tts-generator.ts`:

```typescript
const OPENAI_VOICE_MAP = {
  voice_alex_contemplative: "onyx",
  voice_sam_quiet: "echo",
  voice_jordan_gentle: "nova",
  voice_casey_calm: "shimmer",
  // ... more mappings
};
```

## Dependencies

- **OpenAI SDK** (`openai`) - For script generation and TTS
- **FFmpeg** (optional but recommended) - For audio mixing

### Installing FFmpeg

```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg

# Verify
ffmpeg -version
```

## Testing

Run the AI module tests:

```bash
npm test -- script-generator.test
npm test -- audio-mixer.test
```

## Integration

The AI modules are integrated into `content-generator.ts`:

- `generateCommentary()` - Track intros and commentary
- `generateIdent()` - Station identification
- `generateHandoverSegment()` - Show transitions

All functions now use real AI generation instead of stubs.

## Caching

Script generation uses in-memory caching with a 1-hour TTL to reduce API costs. Cache keys are generated based on:

- Segment type
- Show ID
- Season
- Holiday tags
- Presenter IDs
- Topic

Identical requests within the TTL window will return cached results.

## Error Handling

All AI functions include error handling and will:

1. Log errors with context
2. Return error objects instead of throwing
3. Fall back to simpler implementations when possible (e.g., audio mixing without FFmpeg)

## Cost Optimization

To minimize API costs:

1. **Enable Caching** - Reuses scripts for identical contexts
2. **Use gpt-4o-mini** - Cost-effective model for scripts (~$0.002 per script)
3. **Use OpenAI TTS** - More affordable than ElevenLabs (~$0.003 per segment)
4. **Monitor Usage** - Track API calls in logs

Estimated costs with caching (80% hit rate):
- Scripts: ~$0.06/day
- TTS: ~$0.06/day
- **Total: ~$0.12/day or ~$3.50/month**

## Future Enhancements

- [ ] Streaming TTS for real-time generation
- [ ] Voice cloning for unique presenter voices
- [ ] Quality scoring for generated content
- [ ] A/B testing for prompt optimization
- [ ] Persistent cache (Redis/file-based)
- [ ] Music generation integration
- [ ] Advanced audio effects (crossfading, normalization)
