# Station Configuration Schema

## File: `config/station.json`

This file defines global settings for Lofield FM that apply across all shows.

## Schema Structure

### Root Object

```json
{
  "name": string,
  "tagline": string,
  "timezone": string,
  "frequency": string,
  "description": string,
  "default_ratios": object,
  "default_timing": object,
  "default_tone": object,
  "forbidden_styles": array,
  "forbidden_topics": array,
  "seasons": object,
  "ai_budget": object,
  "streaming": object,
  "moderation": object
}
```

## Field Definitions

### Basic Information

- **name** (string, required): Official station name
  - Example: `"Lofield FM"`

- **tagline** (string, required): Station slogan
  - Example: `"Background noise for people just trying to make it through the day."`

- **timezone** (string, required): IANA timezone identifier
  - Example: `"Europe/London"`
  - Used for scheduling and time-based content

- **frequency** (string, optional): Fictional broadcast frequency
  - Example: `"A frequency that probably doesn't exist"`
  - Used in station idents

- **description** (string, optional): Brief station description
  - Used for external promotion and documentation

### default_ratios

Station-wide music and talk ratio limits. Music is capped at a maximum to ensure talk and banter dominate the station.

```json
{
  "max_music_fraction": number,
  "min_talk_fraction": number,
  "description": string
}
```

- **max_music_fraction** (number, required): Maximum music percentage (0.0-1.0)
  - Set to 0.60 (60%) to cap music and ensure talk dominates
  - Individual shows must not exceed this limit

- **min_talk_fraction** (number, required): Minimum talk percentage (0.0-1.0)
  - Set to 0.40 (40%) to ensure adequate banter and discussion
  - Individual shows must meet or exceed this minimum
  - Equals 1.0 - max_music_fraction

### default_timing

Default timing constraints for presenter segments.

```json
{
  "max_link_seconds": number,
  "min_gap_between_links_seconds": number,
  "handover_duration_seconds": number,
  "station_ident_seconds": number
}
```

- **max_link_seconds** (number, required): Maximum presenter intro length
  - Default: 30 seconds
  - Individual shows may override

- **min_gap_between_links_seconds** (number, required): Minimum music between talk segments
  - Default: 180 seconds (3 minutes)

- **handover_duration_seconds** (number, required): Length of show handovers
  - Fixed at 300 seconds (5 minutes)
  - Not overridable by individual shows

- **station_ident_seconds** (number, optional): Length of station IDs
  - Typical: 5-10 seconds

### default_tone

Core voice characteristics shared by all presenters.

```json
{
  "keywords": array of strings,
  "description": string
}
```

- **keywords** (array, required): Tone descriptors
  - Examples: `"dry"`, `"understated"`, `"self-deprecating"`
  - Used to guide LLM prompt generation

- **description** (string, optional): Explanation of the tone

### forbidden_styles

Array of presentation styles to avoid.

```json
[
  "motivational speeches",
  "fake enthusiasm",
  "shouting"
]
```

- List of strings describing unwanted presentation approaches
- Used for content moderation and LLM prompt guardrails

### forbidden_topics

Array of content topics that are not allowed.

```json
[
  "politics",
  "health advice",
  "explicit content"
]
```

- List of strings describing banned subject matter
- Applied to both presenter scripts and listener requests

### seasons

Seasonal definitions and tone adjustments.

```json
{
  "spring": {
    "months": array of numbers,
    "description": string,
    "tone_adjustment": string
  }
}
```

Each season object contains:

- **months** (array, required): Month numbers (1-12)
  - Example: `[3, 4, 5]` for March-May

- **description** (string, optional): Season characteristics

- **tone_adjustment** (string, required): Guidance for seasonal references
  - Example: `"Reference longer days, spring weather, renewed energy"`

Supported seasons: `spring`, `summer`, `autumn`, `winter`

### ai_budget

Global AI resource limits.

```json
{
  "max_tokens_per_hour": number,
  "max_tts_seconds_per_hour": number,
  "max_music_minutes_per_hour": number,
  "description": string,
  "notes": array
}
```

- **max_tokens_per_hour** (number, required): LLM token budget
  - Covers presenter scripts and music prompt normalization

- **max_tts_seconds_per_hour** (number, required): TTS generation budget
  - Total seconds of speech generated per hour

- **max_music_minutes_per_hour** (number, required): Music generation budget
  - Total minutes of music generated per hour

- **description** (string, optional): Budget explanation

- **notes** (array, optional): Additional clarifications

### streaming

Streaming and buffer configuration.

```json
{
  "buffer_minutes": number,
  "fallback_content_hours": number,
  "description": string
}
```

- **buffer_minutes** (number, required): Pre-generation buffer
  - How far ahead to generate content

- **fallback_content_hours** (number, required): Emergency content library size
  - Hours of backup content for system failures

### moderation

Request moderation settings.

```json
{
  "auto_filter_enabled": boolean,
  "community_moderation_enabled": boolean,
  "min_upvotes_for_priority": number,
  "description": string
}
```

- **auto_filter_enabled** (boolean, required): Automatic content filtering

- **community_moderation_enabled** (boolean, required): Community voting system

- **min_upvotes_for_priority** (number, optional): Upvote threshold for prioritization

## Validation Rules

1. `max_music_fraction` must be ≤ 0.60 (music capped at 60%)
2. `min_talk_fraction` must be ≥ 0.40 (at least 40% talk required)
3. `max_music_fraction + min_talk_fraction` must equal 1.0
4. `timezone` must be valid IANA timezone
5. Season months must cover all 12 months exactly once
6. All numeric values must be positive

## Example

See `config/station.json` for a complete working example.

## Notes

- All times and durations are in seconds unless otherwise specified
- Fractions are represented as decimals (0.0-1.0)
- This configuration provides defaults that individual shows can override
- Changes to global settings affect all shows unless overridden
