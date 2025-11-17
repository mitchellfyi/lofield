# Show Configuration Schema

## File: `config/shows/{show_id}.json`

Individual show configuration files define the schedule, presenters, tone, and content for each 3-hour show.

## Schema Structure

### Root Object

```json
{
  "id": string,
  "name": string,
  "description": string,
  "schedule": object,
  "ratios": object,
  "timing": object,
  "presenters": object,
  "tone": object,
  "topics": object,
  "commentary_style": object,
  "handover": object,
  "season_overrides": object,
  "holiday_overrides": object,
  "ai_budget": object
}
```

## Field Definitions

### Basic Information

- **id** (string, required): Unique show identifier
  - Snake_case format
  - Must match filename
  - Example: `"night_shift"`

- **name** (string, required): Human-readable show name
  - Example: `"Night Shift"`

- **description** (string, required): Show purpose and vibe
  - 2-3 sentences explaining the show's target audience and approach

### schedule

Show timing and frequency.

```json
{
  "days": array of strings,
  "start_time_utc": string,
  "end_time_utc": string,
  "duration_hours": number
}
```

- **days** (array, required): Days of the week the show airs
  - Valid values: `"mon"`, `"tue"`, `"wed"`, `"thu"`, `"fri"`, `"sat"`, `"sun"`
  - For daily shows: all seven days

- **start_time_utc** (string, required): Start time in UTC (HH:MM format)
  - Example: `"09:00"`

- **end_time_utc** (string, required): End time in UTC (HH:MM format)
  - Example: `"12:00"`

- **duration_hours** (number, required): Show length in hours
  - All shows are currently 3 hours

### ratios

Music-to-talk balance for this show.

```json
{
  "music_fraction": number,
  "talk_fraction": number
}
```

- **music_fraction** (number, required): Percentage of show that is music (0.0-1.0)
  - Must be ≥ 0.60 (station minimum)
  - Example: `0.70` for 70% music

- **talk_fraction** (number, required): Percentage of show that is talk (0.0-1.0)
  - Must be ≤ 0.40 (station maximum)
  - Example: `0.30` for 30% talk
  - Must equal `1.0 - music_fraction`

### timing

Show-specific timing overrides.

```json
{
  "max_link_seconds": number,
  "min_gap_between_links_seconds": number,
  "typical_track_length_seconds": number
}
```

- **max_link_seconds** (number, required): Maximum presenter intro length
  - Override of station default
  - Focus shows may use lower values (15-20s)

- **min_gap_between_links_seconds** (number, required): Minimum music between talk
  - Higher values for focus shows (300s), lower for chatty shows (180s)

- **typical_track_length_seconds** (number, optional): Average track duration
  - Used for scheduling calculations
  - Default: 210 seconds (3.5 minutes)

### presenters

Presenter assignment and duo/solo configuration.

```json
{
  "primary_duo": array of strings,
  "duo_probability": number,
  "solo_probability": number,
  "notes": string
}
```

- **primary_duo** (array, required): Two presenter IDs
  - Must reference existing presenters in `presenters.json`
  - Example: `["alex", "sam"]`

- **duo_probability** (number, required): Likelihood of duo segments (0.0-1.0)
  - Example: `0.80` for 80% duo, 20% solo

- **solo_probability** (number, required): Likelihood of solo segments (0.0-1.0)
  - Must equal `1.0 - duo_probability`

- **notes** (string, optional): Presenter usage notes

### tone

Show-specific tone and mood.

```json
{
  "keywords": array of strings,
  "energy_level": string,
  "mood": string
}
```

- **keywords** (array, required): Tone descriptors
  - Example: `["quiet", "contemplative", "surreal"]`
  - Used to guide LLM script generation

- **energy_level** (string, required): Overall energy
  - Values: `"very low"`, `"low"`, `"moderate"`, `"high"`

- **mood** (string, required): Emotional character of the show
  - Example: `"Calm, accepting of the late hour, mildly philosophical"`

### topics

Content themes and restrictions.

```json
{
  "primary_tags": array of strings,
  "banned_tags": array of strings,
  "allow_listener_requests": boolean,
  "typical_request_themes": array of strings
}
```

- **primary_tags** (array, required): Main topic tags for this show
  - Must exist in `tags.json` allowed list
  - Example: `["late_night_work", "insomnia", "contemplative"]`

- **banned_tags** (array, optional): Show-specific banned tags
  - In addition to global banned topics
  - Example: `["high_energy", "morning_routine"]`

- **allow_listener_requests** (boolean, required): Whether to read requests
  - Most shows: `true`

- **typical_request_themes** (array, optional): Common request types
  - Example: `["late night coding", "insomnia vibes"]`

### commentary_style

Presenter script guidelines.

```json
{
  "typical_intro_length_seconds": number,
  "longer_segment_frequency": string,
  "longer_segment_length_seconds": number,
  "check_ins": array of strings,
  "sample_lines": array of strings
}
```

- **typical_intro_length_seconds** (number, required): Standard intro duration
  - Usually 15-30 seconds

- **longer_segment_frequency** (string, required): How often to do longer segments
  - Values: `"rare"`, `"occasional"`, `"regular"`, `"frequent"`

- **longer_segment_length_seconds** (number, required): Extended segment duration
  - Usually 45-90 seconds

- **check_ins** (array, optional): Brief phrases for check-ins
  - Example: `["Anyone else still awake?", "For everyone in a different timezone"]`

- **sample_lines** (array, required): Example presenter scripts
  - Demonstrates the show's voice
  - Used as style examples for LLM

### handover

Show transition configuration.

```json
{
  "duration_seconds": number,
  "style": string,
  "typical_themes": array of strings
}
```

- **duration_seconds** (number, required): Handover length
  - Always 300 seconds (5 minutes)

- **style** (string, required): Handover approach description

- **typical_themes** (array, optional): Common handover topics

### season_overrides

Seasonal content adjustments.

```json
{
  "winter": {
    "tone_adjustment": string,
    "additional_topics": array of strings
  }
}
```

Each season can have:

- **tone_adjustment** (string, required): Seasonal reference guidance
  - Example: `"Reference long dark nights, seasonal insomnia"`

- **additional_topics** (array, optional): Season-specific topic tags

### holiday_overrides

Holiday-specific modifications.

```json
{
  "christmas_period": {
    "dates": array of strings,
    "tone_adjustment": string,
    "notes": string,
    "sample_line": string
  }
}
```

- **dates** (array, required): ISO date strings (YYYY-MM-DD)

- **tone_adjustment** (string, required): How to handle the holiday

- **notes** (string, optional): Additional context

- **sample_line** (string, optional): Example holiday reference

### ai_budget

Show-specific AI resource limits.

```json
{
  "max_tokens_per_show": number,
  "max_tts_seconds_per_show": number,
  "max_music_minutes_per_show": number,
  "notes": string
}
```

- **max_tokens_per_show** (number, required): LLM token budget
  - Based on talk ratio and show length

- **max_tts_seconds_per_show** (number, required): TTS generation budget
  - Should equal talk_fraction × 10800 seconds (3 hours)

- **max_music_minutes_per_show** (number, required): Music generation budget
  - Should equal music_fraction × 180 minutes (3 hours)

- **notes** (string, optional): Budget calculation explanation

## Validation Rules

1. `id` must match filename
2. `music_fraction` must be ≥ 0.60
3. `music_fraction + talk_fraction` must equal 1.0
4. All presenter IDs must exist in `presenters.json`
5. All topic tags must exist in `tags.json`
6. Schedule times must not overlap with other shows
7. `duration_hours` must be 3
8. `handover.duration_seconds` must be 300
9. TTS budget should align with talk_fraction

## Example

See any file in `config/shows/` for complete working examples.

## Notes

- Shows run for exactly 3 hours each
- The 24-hour schedule is divided into 8 shows
- Each show should have a distinct personality while maintaining core Lofield FM tone
- AI budgets ensure sustainable operation within resource constraints
