# JSON Schema Documentation

This directory contains documentation for the Lofield FM configuration file schemas.

## Overview

The Lofield FM configuration system uses JSON files to define how the AI radio station operates. The schemas are organized into the following categories:

1. **Station Configuration** (`config/station.json`) - Global station settings
2. **Show Configurations** (`config/shows/*.json`) - Individual show definitions
3. **Presenter Configuration** (`config/presenters.json`) - Presenter metadata and voice profiles
4. **Tag Configuration** (`config/tags.json`) - Topic tags, banned content, and holiday definitions

## File Locations

```
config/
├── station.json           # Global station settings
├── presenters.json        # All presenter definitions
├── tags.json             # Topic and holiday tags
└── shows/                # Individual show configurations
    ├── night_shift.json
    ├── early_hours.json
    ├── morning_commute.json
    ├── mid_morning_focus.json
    ├── lunchtime_wind_down.json
    ├── afternoon_push.json
    ├── evening_wind_down.json
    └── late_evening.json
```

## Schema Files

- `station_schema.md` - Documentation for global station configuration
- `show_schema.md` - Documentation for individual show configurations
- `presenter_schema.md` - Documentation for presenter definitions
- `tag_schema.md` - Documentation for topic and holiday tags

## Usage Guidelines

### Adding a New Show

1. Create a new JSON file in `config/shows/` following the naming convention: `{show_id}.json`
2. Use the template in `show_schema.md` as a starting point
3. Ensure the show ID is unique and matches the filename
4. Reference existing presenters by their IDs from `presenters.json`
5. Use only allowed topic tags from `tags.json`
6. Ensure music fraction is at least 0.60 (60% music minimum)
7. Set appropriate AI budget limits
8. Validate the JSON syntax before committing

### Adding a New Presenter

1. Add a new entry to the `presenters` array in `config/presenters.json`
2. Assign a unique presenter ID
3. Define a unique voice ID for the TTS system
4. Specify the role (anchor, sidekick, or producer)
5. Write a persona description matching the Lofield FM tone
6. List which shows the presenter appears on
7. Add any seasonal or show-specific quirks

### Adding New Topic Tags

1. Add allowed tags to the `allowed_topic_tags` array in `config/tags.json`
2. If a tag represents banned content, add it to `banned_topic_tags` instead
3. For holiday-specific tags, add an entry to `holiday_tags` with the date as the key
4. Update the `topic_categories` object to help organize related tags

### Modifying Global Settings

1. Edit `config/station.json` for station-wide changes
2. Be cautious when changing default ratios or AI budgets
3. Season definitions should align with British seasonal patterns
4. Forbidden topics and styles should maintain the station's editorial standards

## Validation

Before committing configuration changes:

1. **Syntax**: Ensure all JSON files are valid (no trailing commas, proper quotes)
2. **Cross-references**: Verify presenter IDs used in shows exist in `presenters.json`
3. **Topic tags**: Ensure show topic tags exist in `tags.json` allowed list
4. **Music ratios**: Verify all shows maintain at least 60% music
5. **Timing**: Check that show schedules cover 24 hours with no gaps or overlaps
6. **AI budgets**: Ensure per-show budgets align with show duration and talk ratio

## Testing

After making configuration changes:

1. Parse all JSON files to verify syntax
2. Check cross-references between files
3. Validate that all presenter IDs are consistent
4. Ensure show schedules cover the full 24-hour period
5. Verify topic tags are properly categorized
6. Test that holiday dates are in correct format (YYYY-MM-DD)

## Style Guidelines

When writing configuration content:

- Keep descriptions clear and concise
- Use British English spelling and conventions
- Match the Lofield FM tone (dry, understated, self-aware)
- Reference the docs/ directory for voice and style guidance
- Sample lines should feel natural when read by TTS
- Timing values should be realistic for radio operations

## Extension Points

The schema is designed to be extensible:

- **New show fields**: Add optional fields to show configs for experimental features
- **Presenter metadata**: Add new fields to presenter profiles as needed
- **Season overrides**: Expand seasonal adjustments with more granular controls
- **Holiday tags**: Add new holiday dates as they become relevant
- **Topic categories**: Create new category groupings for tag organization

## Notes

- All times are in UTC to avoid timezone confusion
- Show durations are fixed at 3 hours each
- Handover duration is standardized at 300 seconds (5 minutes)
- Music must never fall below 60% of any show
- AI budget limits help control operational costs

## Support

For questions about the schema or configuration system:

1. Review the documentation in this directory
2. Check the main docs/ folder for context on voice, tone, and station operations
3. Look at existing show configurations as examples
4. Refer to `docs/schedule.md` for show timing and presenter information
5. See `docs/style_guide.md` for tone and content guidelines
