# AI Modules Quick Start Guide

## Setup (5 minutes)

### 1. Install Dependencies

```bash
cd web
npm install
npm install replicate  # For music generation
```

### 2. Get API Keys

- **OpenAI**: https://platform.openai.com/api-keys
- **Replicate**: https://replicate.com/account
- **ElevenLabs** (optional): https://elevenlabs.io

### 3. Configure Environment

Copy `.env.example` to `.env` and add your keys:

```bash
OPENAI_API_KEY=sk-...
REPLICATE_API_TOKEN=r8_...
ELEVENLABS_API_KEY=...  # Optional
```

## Usage Examples

### Generate Music

```typescript
import { generateMusic } from "@/lib/ai";

const result = await generateMusic({
  prompt: "chill lofi beats for coding",
  duration: 180,
  mood: ["calm", "focused"],
  tags: ["coding_session"],
});

if (result.success) {
  console.log("Track saved to:", result.filePath);
  console.log("Title:", result.metadata?.title);
}
```

### Generate Script

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
});

if (result.success) {
  console.log("Script:", result.transcript);
}
```

### Generate TTS

```typescript
import { generateTTS } from "@/lib/ai";

const result = await generateTTS({
  text: "That was 'Chill Beats' requested by Alex.",
  voiceId: "voice_1",
  presenterName: "Presenter One",
});

if (result.success) {
  console.log("Audio saved to:", result.filePath);
}
```

## Testing

```bash
# Run all tests
npm test

# Run AI module tests only
npm test -- lib/ai/__tests__

# Run with coverage
npm test -- --coverage lib/ai/__tests__
```

## Troubleshooting

### "API key not set"
- Check `.env` file exists in `web/` directory
- Verify environment variables are set correctly
- Restart dev server after changing `.env`

### "Module not found: replicate"
```bash
cd web
npm install replicate
```

### "Failed to download audio"
- Check `AUDIO_STORAGE_PATH` is writable
- Default: `/tmp/lofield/audio`
- Ensure sufficient disk space

### "Rate limit exceeded"
- Wait a few minutes before retrying
- Check API usage in provider dashboard
- Consider upgrading API plan

## Configuration

### Quick Settings

```bash
# Default (recommended)
MUSIC_CACHE_ENABLED=true
SCRIPT_CACHE_ENABLED=true
TTS_CACHE_ENABLED=true

# Fast generation (lower quality)
SCRIPT_TEMPERATURE=0.3
MUSIC_DEFAULT_DURATION=120

# High quality (slower, more expensive)
SCRIPT_MODEL=gpt-4
TTS_PROVIDER=elevenlabs
```

## Cost Management

### Enable Caching (Default)
Reduces costs by ~60%:
```bash
MUSIC_CACHE_ENABLED=true  # 24h TTL
SCRIPT_CACHE_ENABLED=true # 1h TTL
TTS_CACHE_ENABLED=true    # 24h TTL
```

### Monitor Usage

```typescript
import {
  getMusicCacheStats,
  getScriptCacheStats,
  getTTSCacheStats,
} from "@/lib/ai";

console.log("Music cache:", getMusicCacheStats());
console.log("Script cache:", getScriptCacheStats());
console.log("TTS cache:", getTTSCacheStats());
```

### Clear Caches

```typescript
import {
  clearMusicCache,
  clearScriptCache,
  clearTTSCache,
} from "@/lib/ai";

clearMusicCache();
clearScriptCache();
clearTTSCache();
```

## Integration with Scheduler

```typescript
// In services/scheduler/index.ts
import {
  generateMusic,
  generateScript,
  generateTTS,
} from "../../web/lib/ai";

// Generate content pipeline
const musicResult = await generateMusic({
  prompt: request.normalized,
  duration: 180,
});

const scriptResult = await generateScript({
  segmentType: "track_intro",
  showStyle: currentShow.style,
  trackInfo: {
    title: musicResult.metadata?.title,
    requester: request.userName,
  },
});

const ttsResult = await generateTTS({
  text: scriptResult.transcript!,
  voiceId: presenter.voiceId,
});

// Save to database
await prisma.segment.create({
  data: {
    showId: currentShow.id,
    type: "music",
    filePath: musicResult.filePath!,
    // ...
  },
});
```

## Common Patterns

### Error Handling

```typescript
const result = await generateMusic({ prompt: "lofi beats" });

if (!result.success) {
  if (result.error?.includes("API_KEY")) {
    // Handle missing API key
  } else if (result.error?.includes("rate limit")) {
    // Queue for retry later
  } else {
    // Use fallback content
  }
}
```

### Batch Processing

```typescript
const requests = [/* ... */];
const results = await Promise.all(
  requests.map(req => generateMusic(req))
);

const successful = results.filter(r => r.success);
console.log(`Generated ${successful.length}/${requests.length} tracks`);
```

### Custom Configuration

```typescript
import { getAIConfig, validateAIConfig } from "@/lib/ai";

const config = getAIConfig();
config.music.defaultDuration = 240; // Override default

validateAIConfig(config); // Throws if invalid
```

## Documentation

- **Usage Guide**: `web/lib/ai/README.md` (detailed API docs)
- **Selection Guide**: `docs/ai-modules.md` (why we chose each service)
- **Environment Config**: `.env.example` (all configuration options)

## Support

- Check inline JSDoc comments in source files
- Review test files for usage examples
- Read comprehensive documentation in README
- Open GitHub issue for bugs or questions

## Development Workflow

1. **Make changes** to AI modules
2. **Run tests**: `npm test -- lib/ai/__tests__`
3. **Run linter**: `npm run lint`
4. **Test manually** with real API keys
5. **Check costs** in provider dashboards
6. **Commit** with descriptive message

## Production Checklist

- [ ] Set production API keys in environment
- [ ] Enable caching for all modules
- [ ] Configure appropriate storage paths
- [ ] Set up cost monitoring alerts
- [ ] Test with production-like load
- [ ] Review generated content quality
- [ ] Monitor error rates and logs

---

*Quick Start Guide • Lofield FM AI Modules*
