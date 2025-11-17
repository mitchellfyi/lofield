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
    ├── night_shift.json           → insomniac_office.json           (00:00-03:00)
    ├── early_hours.json           → deep_work_allegedly.json        (03:00-06:00)
    ├── morning_commute.json       → mild_panic_mornings.json        (06:00-09:00)
    ├── mid_morning_focus.json     → deep_work_calendar_blocks.json  (09:00-12:00)
    ├── lunchtime_wind_down.json   → lunch_procrastination_club.json (12:00-15:00)
    ├── afternoon_push.json        → afternoon_survival_session.json (15:00-18:00)
    ├── evening_wind_down.json     → commute_to_nowhere.json         (18:00-21:00)
    └── late_evening.json          → lofield_night_school.json       (21:00-00:00)
```

## Configuration Files

### station.json

Defines global station settings including:
- Station name, tagline, and timezone
- Default talk/music ratio limits (music capped at 60% maximum)
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
- Music/talk ratios (music capped at 60%, talk minimum 40%)
- Presenter duo assignments
- Show-specific tone and energy level
- Primary topics and banned tags
- Commentary style guidelines
- Handover settings
- Seasonal and holiday overrides
- AI budget allocations

## Schedule Overview

The 24-hour schedule is divided into eight 3-hour shows:

| Time (UTC)  | Show                                   | Presenters      | Music | Talk |
|-------------|----------------------------------------|-----------------|-------|------|
| 00:00-03:00 | Insomniac Office                      | Alex & Sam      | 50%   | 50%  |
| 03:00-06:00 | Deep Work, Allegedly                  | Jordan & Casey  | 55%   | 45%  |
| 06:00-09:00 | Mild Panic Mornings                   | Morgan & Riley  | 50%   | 50%  |
| 09:00-12:00 | Deep Work (According to Calendar Blocks) | Taylor & Drew   | 60%   | 40%  |
| 12:00-15:00 | Lunch Procrastination Club            | Avery & Reese   | 45%   | 55%  |
| 15:00-18:00 | Afternoon Survival Session            | Quinn & Sage    | 50%   | 50%  |
| 18:00-21:00 | Commute to Nowhere                    | Rowan & Finley  | 50%   | 50%  |
| 21:00-00:00 | Lofield Night School                  | Harper & River  | 55%   | 45%  |

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
- Music ratio requirements (music capped at 60% maximum)
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
- Music is capped at 60% maximum; talk must be at least 40%
- All JSON files must be valid (no trailing commas)
- Cross-references must be consistent between files

## Contributing

When modifying these configurations:

1. Maintain the Lofield FM tone (dry, understated, self-aware)
2. Ensure music ratios meet maximum requirements (≤ 60% music)
3. Validate changes with the validation script
4. Keep presenter personalities distinct but aligned with station voice
5. Update schema documentation if adding new fields
6. Test that shows reference valid presenters and tags

---

*For more context on the station's voice and style, see the `docs/` directory.*
