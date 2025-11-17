# Lofield FM Configuration

This directory contains the JSON configuration files that define how the AI radio station operates.

## Directory Structure

```
config/
├── README.md              # This file
├── station.json          # Global station settings
├── presenters.json       # All presenter definitions
├── tags.json            # Topic tags, banned content, and holidays
└── shows/               # Individual show configurations
    ├── night_shift.json           (00:00-03:00)
    ├── early_hours.json           (03:00-06:00)
    ├── morning_commute.json       (06:00-09:00)
    ├── mid_morning_focus.json     (09:00-12:00)
    ├── lunchtime_wind_down.json   (12:00-15:00)
    ├── afternoon_push.json        (15:00-18:00)
    ├── evening_wind_down.json     (18:00-21:00)
    └── late_evening.json          (21:00-00:00)
```

## Configuration Files

### station.json

Defines global station settings including:
- Station name, tagline, and timezone
- Default talk/music ratio limits (max 60% music requirement)
- Season definitions and tone adjustments
- Forbidden styles and topics
- AI budget limits for tokens, TTS, and music generation
- Streaming and moderation settings

### presenters.json

Lists all 16 presenters (8 duos) with:
- Unique IDs and names
- Voice profile mappings for TTS
- Role assignments (anchor/sidekick)
- Persona descriptions
- Show assignments
- Distinctive quirks and characteristics

### tags.json

Defines the tag universe:
- 100+ allowed topic tags for content classification
- Banned topic tags for content filtering
- Holiday tags mapped to specific dates
- Seasonal tags for contextual awareness
- Topic categories for organization

### shows/*.json

Eight 3-hour show configurations covering the full 24-hour schedule. Each includes:
- Show identity (ID, name, description)
- Schedule (days, times, duration)
- Music/talk ratios (all shows maintain 60%+ music)
- Presenter duo assignments
- Show-specific tone and energy level
- Primary topics and banned tags
- Commentary style guidelines
- Handover settings
- Seasonal and holiday overrides
- AI budget allocations

## Schedule Overview

The 24-hour schedule is divided into eight 3-hour shows:

| Time (UTC)  | Show                  | Presenters      | Music | Talk |
|-------------|-----------------------|-----------------|-------|------|
| 00:00-03:00 | Night Shift           | Alex & Sam      | 70%   | 30%  |
| 03:00-06:00 | Early Hours           | Jordan & Casey  | 70%   | 30%  |
| 06:00-09:00 | Morning Commute       | Morgan & Riley  | 65%   | 35%  |
| 09:00-12:00 | Mid-Morning Focus     | Taylor & Drew   | 75%   | 25%  |
| 12:00-15:00 | Lunchtime Wind-Down   | Avery & Reese   | 65%   | 35%  |
| 15:00-18:00 | Afternoon Push        | Quinn & Sage    | 70%   | 30%  |
| 18:00-21:00 | Evening Wind-Down     | Rowan & Finley  | 65%   | 35%  |
| 21:00-00:00 | Late Evening          | Harper & River  | 70%   | 30%  |

## Usage

These configuration files are designed to be read by the Lofield FM playout engine and AI content generation system. They provide:

1. **Scheduling information** for determining which show should be playing
2. **Presenter context** for generating appropriate AI commentary
3. **Topic guidance** for matching music requests to shows
4. **Budget limits** for controlling AI resource usage
5. **Seasonal context** for time-appropriate references

## Validation

Use the validation script to check configuration integrity:

```bash
python3 scripts/validate_config.py
```

This validates:
- JSON syntax correctness
- Cross-reference consistency (presenter IDs, topic tags)
- Music ratio requirements (minimum 60% music)
- Schedule coverage (24-hour period with no gaps)
- AI budget alignment with show parameters

## Extending the Configuration

See the `schemas/` directory for detailed documentation on:
- Adding new shows
- Creating new presenters
- Defining additional topic tags
- Modifying global settings
- Implementing seasonal overrides

## Schema Documentation

Full schema documentation is available in the `schemas/` directory:
- `README.md` - Overview and guidelines
- `station_schema.md` - Station configuration schema
- `show_schema.md` - Show configuration schema
- `presenter_schema.md` - Presenter configuration schema
- `tag_schema.md` - Tag configuration schema

## Notes

- All times are in UTC (Europe/London timezone)
- Show durations are fixed at 3 hours
- Handover duration is standardized at 5 minutes (300 seconds)
- Music must never fall below 60% of any show
- All JSON files must be valid (no trailing commas)
- Cross-references must be consistent between files

## Contributing

When modifying these configurations:

1. Maintain the Lofield FM tone (dry, understated, self-aware)
2. Ensure music ratios meet minimum requirements
3. Validate changes with the validation script
4. Keep presenter personalities distinct but aligned with station voice
5. Update schema documentation if adding new fields
6. Test that shows reference valid presenters and tags

---

*For more context on the station's voice and style, see the `docs/` directory.*
