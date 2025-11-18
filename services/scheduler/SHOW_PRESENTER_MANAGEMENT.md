# Show and Presenter Management System

## Overview

The Show and Presenter Management System provides a comprehensive framework for managing Lofield FM's dynamic schedule of 3-hour shows with unique talk/music ratios, moods, topics, and presenter pairings.

## Architecture

The system consists of four core modules:

1. **Show Manager** - Configuration loading and validation
2. **Presenter Manager** - Voice assignment and duo/solo logic
3. **Topic Selector** - Topic and mood selection with seasonal context
4. **Queue Builder** - Talk/music ratio enforcement

## Modules

### Show Manager (`show-manager.ts`)

Handles loading and managing show configuration files.

#### Key Functions

**`loadShowConfigs(forceReload?: boolean): Map<string, ShowConfig>`**
- Loads all show configurations from `config/shows/*.json`
- Caches results for 60 seconds
- Returns a map of show ID to ShowConfig

**`getShowConfig(showId: string): ShowConfig | null`**
- Retrieves a specific show configuration by ID
- Returns null if show not found

**`validateShowConfig(config: ShowConfig): { valid: boolean; errors: string[] }`**
- Validates show configuration meets all requirements:
  - Music fraction ≤ 0.60 (60% maximum)
  - Talk fraction ≥ 0.40 (40% minimum)
  - Music + talk = 1.0
  - Primary duo has exactly 2 presenters
  - Duration is 3 hours
  - Handover is 300 seconds (if present)

**`getShowConfigWithOverrides(showId: string, season: string, holidayName?: string): ShowConfig | null`**
- Returns show config with seasonal and holiday overrides applied
- Merges additional topics from season_overrides
- Applies tone adjustments

**`reloadShowConfigs(): void`**
- Forces reload of all show configurations from disk
- Useful for hot-reloading without service restart

#### Example Usage

```typescript
import { loadShowConfigs, getShowConfig, validateShowConfig } from './show-manager';

// Load all shows
const shows = loadShowConfigs();
console.log(`Loaded ${shows.size} shows`);

// Get a specific show
const show = getShowConfig('deep_work_calendar_blocks');
if (show) {
  console.log(`Show: ${show.name}`);
  console.log(`Music: ${show.ratios.music_fraction * 100}%`);
  console.log(`Talk: ${show.ratios.talk_fraction * 100}%`);
}

// Validate configuration
const validation = validateShowConfig(show);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}

// Get with seasonal overrides
const winterShow = getShowConfigWithOverrides('deep_work_calendar_blocks', 'winter');
console.log('Winter topics:', winterShow?.topics.primary_tags);
```

### Presenter Manager (`presenter-manager.ts`)

Manages presenter configurations, voice assignments, and duo/solo presentation logic.

#### Key Functions

**`loadPresentersConfig(forceReload?: boolean): PresentersConfig`**
- Loads all presenter configurations from `config/presenters.json`
- Returns presenters array and voice profile metadata

**`getPresenter(presenterId: string): Presenter | null`**
- Retrieves a specific presenter by ID

**`getPresenterVoiceMap(): Record<string, string>`**
- Returns mapping of presenter IDs to voice IDs for TTS

**`selectPresenters(primaryDuo: string[], duoProbability: number): { presenters: string[]; isDuo: boolean }`**
- Probabilistically selects duo or solo based on show config
- Returns selected presenter IDs and whether it's a duo segment

**`getAnchorAndSidekick(presenterIds: string[]): { anchor: Presenter | null; sidekick: Presenter | null }`**
- Identifies anchor and sidekick from a duo
- Anchor leads segments, sidekick provides contrast

**`splitScriptForDuo(script: string, presenterIds: string[]): { presenterId: string; text: string }[]`**
- Splits a script into lines for multiple presenters
- Anchor gets more lines (pattern: anchor, anchor, sidekick)
- Splits by sentences using punctuation

#### Example Usage

```typescript
import { 
  loadPresentersConfig, 
  selectPresenters, 
  getPresenterVoiceId,
  splitScriptForDuo 
} from './presenter-manager';

// Load presenters
const config = loadPresentersConfig();
console.log(`Loaded ${config.presenters.length} presenters`);

// Select presenters for a segment
const showDuo = ['taylor', 'drew'];
const { presenters, isDuo } = selectPresenters(showDuo, 0.6); // 60% duo probability

if (isDuo) {
  console.log('Duo segment:', presenters);
  
  // Split script between presenters
  const script = "That was a great track. Really fits the mood. Perfect for focus time.";
  const lines = splitScriptForDuo(script, presenters);
  
  lines.forEach(line => {
    const voiceId = getPresenterVoiceId(line.presenterId);
    console.log(`${line.presenterId} (${voiceId}): ${line.text}`);
  });
} else {
  console.log('Solo segment:', presenters[0]);
}
```

### Topic Selector (`topic-selector.ts`)

Handles topic and mood selection for content generation with seasonal context.

#### Key Functions

**`selectTopics(options: TopicSelectionOptions): string[]`**
- Selects topics from show primary tags + seasonal tags
- Excludes banned tags and specified tags
- Returns randomized selection up to maxTags

**`getMoodKeywords(showConfig: ShowConfig, seasonalContext: SeasonalContext): string[]`**
- Returns mood keywords for music generation
- Includes show tone keywords + seasonal context

**`buildPromptContext(showConfig: ShowConfig, seasonalContext: SeasonalContext, includeExamples?: boolean): object`**
- Builds complete context for AI prompt generation
- Includes show info, mood, topics, sample lines, seasonal notes

**`getSegmentDuration(showConfig: ShowConfig, isLonger?: boolean): number`**
- Returns appropriate segment duration from commentary_style
- Normal: typical_intro_length_seconds
- Longer: longer_segment_length_seconds

**`shouldGenerateLongerSegment(frequency: string): boolean`**
- Probabilistically determines if segment should be extended
- Frequencies: rare (10%), occasional (25%), regular (40%), frequent (60%)

**`TopicDiversityTracker`** (class)
- Tracks recently used topics to encourage diversity
- Weights selection to prefer less-recently-used topics
- Methods: `recordTopic()`, `getTopicWeight()`, `selectWeightedTopics()`

#### Example Usage

```typescript
import { 
  selectTopics, 
  getMoodKeywords, 
  buildPromptContext,
  getSegmentDuration,
  shouldGenerateLongerSegment,
  TopicDiversityTracker 
} from './topic-selector';
import { getSeasonalContextWithOverrides } from './show-scheduler';

// Get show config and seasonal context
const showConfig = getShowConfig('deep_work_calendar_blocks');
const seasonalContext = getSeasonalContextWithOverrides(showConfig);

// Select topics
const topics = selectTopics({
  showConfig,
  seasonalContext,
  maxTags: 3,
  excludeTags: ['meetings'] // Don't want this topic right now
});
console.log('Selected topics:', topics);

// Get mood keywords for music generation
const mood = getMoodKeywords(showConfig, seasonalContext);
console.log('Mood keywords:', mood);

// Build full prompt context
const context = buildPromptContext(showConfig, seasonalContext, true);
console.log('Prompt context:', context);

// Determine segment duration
const isLonger = shouldGenerateLongerSegment(showConfig.commentary_style.longer_segment_frequency);
const duration = getSegmentDuration(showConfig, isLonger);
console.log(`Segment duration: ${duration}s`);

// Use diversity tracker
const tracker = new TopicDiversityTracker();
tracker.recordTopic('focus_time');
tracker.recordTopic('focus_time'); // Used twice

const diverseTopics = tracker.selectWeightedTopics(
  ['focus_time', 'deep_work', 'coding'],
  2
);
console.log('Diverse topics:', diverseTopics); // Less likely to pick focus_time
```

### Queue Builder (`queue-builder.ts`)

Enforces talk/music ratios when building segment queues.

#### Key Functions

**`calculateQueueStats(segments: QueuedSegment[]): QueueStats`**
- Calculates comprehensive statistics for a segment queue
- Returns durations, fractions, and segment counts

**`validateQueueRatios(segments: QueuedSegment[], show: Show): { valid: boolean; stats: QueueStats; message?: string }`**
- Validates queue meets show's talk/music ratio requirements
- Allows 5% tolerance for each ratio

**`determineNextSegmentType(currentQueue: QueuedSegment[], show: Show): "music" | "talk" | "balanced"`**
- Analyzes current queue and determines what type to generate next
- Returns "music" if music deficit > 10%
- Returns "talk" if talk deficit > 10%
- Returns "balanced" if ratios are acceptable

**`calculateSegmentNeeds(currentQueue: QueuedSegment[], show: Show, targetDurationMinutes: number): object`**
- Calculates how many music/talk segments needed to fill target duration
- Respects show's talk/music ratios
- Returns segment counts and total duration needed

**`canAddTalkSegment(currentQueue: QueuedSegment[], show: Show): boolean`**
- Checks if enough time has passed since last talk segment
- Respects show's min_gap_between_links_seconds

#### Example Usage

```typescript
import { 
  calculateQueueStats, 
  validateQueueRatios,
  determineNextSegmentType,
  calculateSegmentNeeds,
  formatQueueSummary 
} from './queue-builder';

// Assume we have a queue of segments
const queue: QueuedSegment[] = [...];

// Calculate stats
const stats = calculateQueueStats(queue);
console.log(formatQueueSummary(stats));
// Output: "Queue: 45.2 min total | Music: 27.3 min (60.4%) | Talk: 17.9 min (39.6%) | Segments: 9M 6T 1I 0H"

// Validate ratios
const validation = validateQueueRatios(queue, currentShow);
if (!validation.valid) {
  console.log(`Queue invalid: ${validation.message}`);
}

// Determine what to generate next
const nextType = determineNextSegmentType(queue, currentShow);
console.log(`Next segment should be: ${nextType}`);

if (nextType === "music") {
  // Generate a music track
} else if (nextType === "talk") {
  // Generate presenter commentary
}

// Calculate needs for the next hour
const needs = calculateSegmentNeeds(queue, currentShow, 60); // 60 minutes
console.log(`Need ${needs.musicSegmentsNeeded} music tracks and ${needs.talkSegmentsNeeded} talk segments`);
```

## Integration with Content Generator

The content generator now uses all these modules:

```typescript
import { getShowConfig } from './show-manager';
import { selectPresenters, getPresenterVoiceId, splitScriptForDuo } from './presenter-manager';
import { buildPromptContext, getSegmentDuration, shouldGenerateLongerSegment } from './topic-selector';
import { getSeasonalContextWithOverrides } from './show-scheduler';

export async function generateCommentary(
  request: Request | null,
  show: Show,
  trackTitle: string,
  audioStoragePath: string
): Promise<TTSResult> {
  // 1. Load show config
  const showConfig = getShowConfig(show.id);
  
  // 2. Get seasonal context with overrides
  const seasonalContext = getSeasonalContextWithOverrides(showConfig);
  
  // 3. Select presenters (duo or solo)
  const { presenters, isDuo } = selectPresenters(
    showConfig.presenters.primary_duo,
    showConfig.presenters.duo_probability
  );
  
  // 4. Determine segment duration
  const isLonger = shouldGenerateLongerSegment(
    showConfig.commentary_style.longer_segment_frequency
  );
  const duration = getSegmentDuration(showConfig, isLonger);
  
  // 5. Build prompt context
  const context = buildPromptContext(showConfig, seasonalContext);
  
  // 6. Generate script with LLM (using context)
  const script = await generateScript(context, trackTitle, duration);
  
  // 7. Split script for duo if needed
  const lines = isDuo 
    ? splitScriptForDuo(script, presenters)
    : [{ presenterId: presenters[0], text: script }];
  
  // 8. Generate TTS for each line with appropriate voice
  for (const line of lines) {
    const voiceId = getPresenterVoiceId(line.presenterId);
    await generateTTS(line.text, voiceId);
  }
  
  // 9. Mix audio and return
  return { success: true, filePath: mixedAudioPath, duration };
}
```

## Configuration Hot-Reload

All modules support hot-reloading configurations without service restart:

```typescript
import { reloadShowConfigs } from './show-manager';
import { reloadPresentersConfig } from './presenter-manager';

// In a signal handler or admin endpoint
process.on('SIGUSR1', () => {
  console.log('Reloading configurations...');
  reloadShowConfigs();
  reloadPresentersConfig();
  console.log('Configurations reloaded');
});
```

## Testing

Comprehensive test coverage with 103 tests across all modules:

```bash
npm test

# Run specific module tests
npm test show-manager
npm test presenter-manager
npm test topic-selector
npm test queue-builder
```

## Best Practices

### Show Configuration
- Always validate show configs after loading
- Use `getShowConfigWithOverrides()` for seasonal/holiday content
- Cache show configs to avoid repeated disk reads

### Presenter Management
- Use probabilistic selection for variety
- Respect anchor/sidekick roles when splitting scripts
- Map presenter IDs to voice IDs consistently

### Topic Selection
- Use TopicDiversityTracker to avoid repetition
- Include seasonal context for relevant content
- Exclude recently used topics for variety

### Ratio Enforcement
- Check queue stats regularly
- Use `determineNextSegmentType()` before generating
- Validate final queue before broadcast
- Allow small deviations (±5%) for natural flow

## Troubleshooting

**Show configs not loading:**
- Check that `config/shows/*.json` files exist
- Verify JSON is valid (no trailing commas)
- Check file permissions

**Presenters not found:**
- Ensure `config/presenters.json` exists
- Verify presenter IDs match show config
- Check that all presenters have voice IDs

**Ratio validation failing:**
- Music capped at 60% maximum
- Talk must be at least 40% minimum
- Sum must equal 100% (±0.1% tolerance)

**Topics not diverse:**
- Use TopicDiversityTracker
- Increase maxTags in selection
- Add more topics to show config

## Future Enhancements

- More sophisticated script splitting (dialogue markers)
- Advanced topic weighting based on time of day
- Dynamic ratio adjustment based on listener feedback
- Multi-language support for presenters
- Voice emotion/energy level control
- Cross-show topic coordination
