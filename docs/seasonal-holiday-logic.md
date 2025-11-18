# Seasonal and Holiday Logic

This document describes how Lofield FM adapts to seasons and holidays to provide contextually relevant music and banter.

## Overview

The seasonal and holiday system enables Lofield FM to:
- Automatically detect the current season based on date and hemisphere
- Identify relevant holidays from configuration
- Apply seasonal mood biases to music generation
- Inject holiday-related topic tags into script generation
- Support show-specific seasonal and holiday overrides

## Season Detection

### How It Works

Seasons are determined based on the month and hemisphere (default: Northern Hemisphere for Lofield):

**Northern Hemisphere:**
- Winter: December, January, February
- Spring: March, April, May
- Summer: June, July, August
- Autumn: September, October, November

**Southern Hemisphere:**
- Summer: December, January, February
- Autumn: March, April, May
- Winter: June, July, August
- Spring: September, October, November

### Usage

```typescript
import { getSeason } from "./lib/seasonal";

// Get current season (defaults to Northern Hemisphere)
const season = getSeason();
console.log(season); // "winter" | "spring" | "summer" | "autumn"

// Get season for specific date
const summerDate = new Date("2025-07-15");
const summer = getSeason(summerDate, "northern");
console.log(summer); // "summer"

// Southern Hemisphere
const southernSummer = getSeason(summerDate, "southern");
console.log(southernSummer); // "winter"
```

## Holiday Detection

### Configuration

Holidays are configured in `config/tags.json` under the `holiday_tags` object:

```json
{
  "holiday_tags": {
    "2025-01-01": ["new_year"],
    "2025-10-31": ["halloween"],
    "2025-12-25": ["christmas_day"]
  }
}
```

### Usage

```typescript
import { getHolidaysForDate, isHoliday, getHolidaysInRange } from "./lib/seasonal";

// Check current date
const holidays = getHolidaysForDate();
console.log(holidays); // ["christmas_day"] on Dec 25

// Check if today is a holiday
const isToday = isHoliday();
console.log(isToday); // true or false

// Get all holidays in a date range
const startDate = new Date("2025-12-20");
const endDate = new Date("2025-12-31");
const holidaysInRange = getHolidaysInRange(startDate, endDate);
console.log(holidaysInRange);
// [
//   { date: "2025-12-24", tags: ["christmas_eve"] },
//   { date: "2025-12-25", tags: ["christmas_day"] },
//   { date: "2025-12-26", tags: ["boxing_day"] },
//   { date: "2025-12-31", tags: ["new_years_eve"] }
// ]
```

## Seasonal Mood Biases

Each season has associated mood descriptors and music characteristics:

### Winter
- **Descriptors:** cosy, muted, warm, introspective, gentle
- **Music Mood:** warm and comforting, soft ambient textures, cosy winter atmosphere
- **Topic Bias:** dark mornings, cold weather, heating decisions, cosy indoors

### Spring
- **Descriptors:** fresh, hopeful, light, renewed, gentle
- **Music Mood:** light and refreshing, hopeful spring atmosphere, fresh and airy
- **Topic Bias:** lighter evenings, spring cleaning, renewal, spring weather

### Summer
- **Descriptors:** bright, breezy, relaxed, airy, open
- **Music Mood:** bright and breezy, relaxed summer vibes, warm summer atmosphere
- **Topic Bias:** long evenings, outdoor work, sunshine, summer weather

### Autumn
- **Descriptors:** mellow, reflective, warm, contemplative, rich
- **Music Mood:** mellow autumn tones, reflective and contemplative, warm earthy atmosphere
- **Topic Bias:** darker evenings, back to school energy, cozy indoors, falling leaves

### Usage in Music Generation

```typescript
import { enhanceMusicRequestWithSeason } from "./lib/seasonal";

const musicRequest = {
  prompt: "chill lofi beats for studying",
  duration: 180,
};

// Add seasonal bias
const enhanced = enhanceMusicRequestWithSeason(musicRequest, {
  date: new Date("2025-01-15"), // Winter date
  hemisphere: "northern",
});

console.log(enhanced.seasonalBias);
// "warm and comforting" or "cosy winter atmosphere" (random selection)
```

### Usage in Script Generation

```typescript
import { enhanceScriptRequestWithSeason } from "./lib/seasonal";

const scriptRequest = {
  segmentType: "track_intro",
  showStyle: "mild_panic_mornings",
  presenterIds: ["morgan", "riley"],
};

// Add seasonal and holiday context
const enhanced = enhanceScriptRequestWithSeason(scriptRequest, {
  date: new Date("2025-12-25"), // Christmas
  hemisphere: "northern",
});

console.log(enhanced.contextInfo?.season); // "winter"
console.log(enhanced.contextInfo?.holidayTags); // ["christmas_day"]
```

## Show-Specific Overrides

Shows can define seasonal and holiday overrides in their configuration files (`config/shows/*.json`).

### Season Overrides

Example from `config/shows/morning_commute.json`:

```json
{
  "season_overrides": {
    "winter": {
      "tone_adjustment": "Reference darkness, cold commutes, reluctance to leave bed",
      "additional_topics": ["dark_mornings", "cold_weather", "winter_commute"]
    },
    "summer": {
      "tone_adjustment": "Reference light mornings, nicer weather, easier to get up",
      "additional_topics": ["summer_mornings", "light_commute"]
    }
  }
}
```

**Usage:**

```typescript
import { getShowSeasonOverrides } from "./lib/seasonal";

const showConfig = loadShowConfig("morning_commute");
const overrides = getShowSeasonOverrides(showConfig, {
  date: new Date("2025-01-15"), // Winter
});

console.log(overrides.additionalTopics); // ["dark_mornings", "cold_weather", "winter_commute"]
console.log(overrides.toneAdjustment); // "Reference darkness, cold commutes..."
```

### Holiday Overrides

Example:

```json
{
  "holiday_overrides": {
    "christmas_period": {
      "dates": ["2025-12-24", "2025-12-25", "2025-12-26"],
      "tone_adjustment": "Acknowledge holiday time, people having time off, reduced traffic",
      "notes": "Some people work through holidays"
    },
    "new_year": {
      "dates": ["2026-01-01"],
      "tone_adjustment": "First work day of the year energy, back to normal",
      "sample_line": "New year, same commute"
    }
  }
}
```

**Usage:**

```typescript
import { getShowHolidayOverrides } from "./lib/seasonal";

const showConfig = loadShowConfig("morning_commute");
const overrides = getShowHolidayOverrides(showConfig, {
  date: new Date("2025-12-25"),
});

console.log(overrides?.toneAdjustment); // "Acknowledge holiday time..."
console.log(overrides?.notes); // "Some people work through holidays"
```

## Context Tags

Get all relevant tags (seasonal + holiday) for a given date:

```typescript
import { getContextTags, getContentContextTags } from "./lib/seasonal";

// Get raw context tags
const tags = getContextTags(new Date("2025-12-25"), "northern");
console.log(tags);
// ["winter_weather", "dark_evenings", "heating_decisions", "cold_weather",
//  "seasonal_affective_disorder", "christmas_period", "christmas_day"]

// Get content context tags (same as above, different import)
const contentTags = getContentContextTags({
  date: new Date("2025-12-25"),
  hemisphere: "northern",
});
```

## Adding New Holidays

To add a new holiday:

1. **Edit `config/tags.json`:**
   ```json
   {
     "holiday_tags": {
       "2025-04-22": ["earth_day"],
       "2026-04-22": ["earth_day"]
     }
   }
   ```

2. **Ensure the tag exists in `allowed_topic_tags`:**
   ```json
   {
     "allowed_topic_tags": [
       "earth_day",
       ...
     ]
   }
   ```

3. **Add show-specific overrides if needed:**
   ```json
   {
     "holiday_overrides": {
       "earth_day": {
         "dates": ["2025-04-22", "2026-04-22"],
         "tone_adjustment": "Reference environmental awareness in a low-key way",
         "notes": "Keep it understated, not preachy"
       }
     }
   }
   ```

4. **Run validation:**
   ```bash
   python3 scripts/validate_config.py
   ```

## Adding New Seasonal Moods

To customize seasonal mood profiles, edit `web/lib/seasonal.ts`:

```typescript
const SEASONAL_MOOD_PROFILES: Record<Season, SeasonalMoodProfile> = {
  winter: {
    season: "winter",
    descriptors: ["cosy", "muted", "warm", "introspective", "gentle"],
    musicMood: [
      "warm and comforting",
      "soft ambient textures",
      // Add new mood here
      "crisp winter clarity",
    ],
    topicBias: [
      "dark mornings",
      // Add new topic here
      "hot chocolate weather",
    ],
  },
  // ... other seasons
};
```

## Guidelines for Holiday References

Per the Lofield FM style guide:

✅ **DO:**
- Keep references low-key and understated
- Acknowledge the date without being festive
- Recognize that not everyone celebrates
- Reference practical impacts (e.g., "reduced traffic", "shops closed")

❌ **DON'T:**
- Be overly cheerful or enthusiastic
- Assume everyone is celebrating
- Give religious or spiritual advice
- Make assumptions about listener activities

**Good Examples:**
- "It's December 25th. For those of you working today, solidarity."
- "New Year's Day. The calendar's reset, the inbox hasn't."
- "Halloween. Presumably someone out there is wearing a costume."

**Bad Examples:**
- "Merry Christmas everyone! Hope you're having a magical day!" ❌ (Too enthusiastic)
- "Happy holidays to all our Christian listeners!" ❌ (Assumes religion)
- "Make sure to spend time with family today!" ❌ (Prescriptive advice)

## Testing

Run tests for seasonal logic:

```bash
cd web
npm test -- seasonal
```

Tests cover:
- Season detection for all months in both hemispheres
- Holiday detection for various dates
- Seasonal mood profile retrieval
- Context tag generation
- Show override detection
- Integration with music and script generation

## API Reference

### Core Functions

- `getSeason(date?, hemisphere?)` - Determine season for a date
- `getSeasonalMoodProfile(date?, hemisphere?)` - Get seasonal mood profile
- `getHolidaysForDate(date?)` - Get holidays for a specific date
- `getHolidaysInRange(startDate, endDate)` - Get holidays in date range
- `isHoliday(date?)` - Check if date is a holiday
- `getSeasonalTags(season)` - Get seasonal topic tags
- `getContextTags(date?, hemisphere?)` - Get combined seasonal and holiday tags
- `getSeasonalMusicMood(date?, hemisphere?)` - Get random seasonal music mood
- `applySeasonalBiasToMusicPrompt(prompt, date?, hemisphere?)` - Add seasonal bias to prompt

### Integration Functions

- `enhanceMusicRequestWithSeason(request, config?)` - Add seasonal bias to music request
- `enhanceScriptRequestWithSeason(request, config?)` - Add season/holiday to script request
- `getContentContextTags(config?)` - Get context tags for content generation
- `getShowSeasonOverrides(showConfig, config?)` - Get season overrides from show config
- `getShowHolidayOverrides(showConfig, config?)` - Get holiday overrides from show config

## Integration Example

Complete example of using seasonal logic in content generation:

```typescript
import {
  enhanceMusicRequestWithSeason,
  enhanceScriptRequestWithSeason,
  getShowSeasonOverrides,
  getShowHolidayOverrides,
} from "./lib/seasonal";
import { generateMusic } from "./lib/ai/music-generation";
import { generateScript } from "./lib/ai/script-generation";

// Load show configuration
const showConfig = loadShowConfig("mild_panic_mornings");

// Get current date context
const now = new Date();
const seasonOverrides = getShowSeasonOverrides(showConfig, { date: now });
const holidayOverrides = getShowHolidayOverrides(showConfig, { date: now });

// Generate music with seasonal bias
const musicRequest = {
  prompt: "calm morning coffee vibes",
  duration: 180,
};
const enhancedMusic = enhanceMusicRequestWithSeason(musicRequest, { date: now });
const music = await generateMusic(enhancedMusic);

// Generate script with seasonal and holiday context
const scriptRequest = {
  segmentType: "track_intro",
  showStyle: "mild_panic_mornings",
  presenterIds: ["morgan", "riley"],
  trackInfo: {
    title: music.metadata.title,
  },
};
const enhancedScript = enhanceScriptRequestWithSeason(scriptRequest, { date: now });

// Apply show-specific overrides if present
if (seasonOverrides.toneAdjustment) {
  console.log("Season adjustment:", seasonOverrides.toneAdjustment);
}
if (holidayOverrides?.toneAdjustment) {
  console.log("Holiday adjustment:", holidayOverrides.toneAdjustment);
}

const script = await generateScript(enhancedScript);
```

## Troubleshooting

**Issue: Seasonal bias not appearing in generated music**
- Check that `enableSeasonalBias` is not set to `false`
- Verify the music generation is using the enhanced request
- Check the `seasonalBias` field is being passed through to `enhancePromptForLofi`

**Issue: Holiday tags not showing up**
- Verify the date format in `config/tags.json` is `YYYY-MM-DD`
- Check that `enableHolidayTags` is not set to `false`
- Ensure the tags exist in `allowed_topic_tags`

**Issue: Show overrides not applying**
- Verify the show config JSON structure matches the schema
- Check that season names use lowercase: "winter", "spring", "summer", "autumn"
- Ensure date strings in holiday overrides match ISO format

## Future Enhancements

Potential improvements:
- Regional holiday support (different countries)
- Lunar calendar support (for holidays like Ramadan, Lunar New Year)
- Dynamic season boundaries (meteorological vs. astronomical)
- Weather API integration for real-time context
- Time-of-day mood adjustments
- Multi-day event support (e.g., festival weeks)

---

*Lofield FM: Now with seasonal awareness that's appropriately understated.*
