# Tag Configuration Schema

## File: `config/tags.json`

Defines the universe of allowed topic tags, banned content tags, holiday-specific tags, and tag categorization.

## Schema Structure

### Root Object

```json
{
  "allowed_topic_tags": array of strings,
  "banned_topic_tags": array of strings,
  "holiday_tags": object,
  "seasonal_tags": object,
  "topic_categories": object,
  "notes": array of strings
}
```

## Field Definitions

### allowed_topic_tags

Array of strings representing approved topic tags for content classification.

```json
[
  "remote_work",
  "morning_routine",
  "coffee",
  "focus_time"
]
```

- Used for classifying listener requests
- Referenced in show configuration `primary_tags`
- Should align with Lofield FM's content guidelines
- Tags should be self-explanatory and specific
- Use snake_case format

**Categories of allowed tags:**
- Work-related: remote work, meetings, deadlines
- Time-of-day: morning, lunch, evening, late night
- Mood: contemplative, focused, relaxed
- Music style: lofi vibes, ambient, jazz elements
- Lofield-specific: local landmarks, station lore

### banned_topic_tags

Array of strings representing prohibited content tags.

```json
[
  "politics",
  "health_advice",
  "explicit_content"
]
```

- Triggers automatic filtering in moderation system
- Includes both topic bans (politics) and content bans (explicit material)
- Aligned with station's editorial standards
- Used to reject inappropriate listener requests

**Categories of banned tags:**
- Political content
- Medical/health advice
- Financial advice
- Explicit/inappropriate content
- Hate speech and discrimination
- Misinformation

### holiday_tags

Object mapping dates to holiday tag arrays.

```json
{
  "2025-10-31": ["halloween"],
  "2025-12-25": ["christmas_day"],
  "2026-01-01": ["new_year"]
}
```

- **Keys**: ISO date strings (YYYY-MM-DD format)
- **Values**: Arrays of holiday tag strings
- Used to add seasonal context to shows
- References should be low-key, not overly festive
- Includes UK public holidays and notable dates
- Updated annually with new years

**Included holidays:**
- New Year (Jan 1)
- Valentine's Day (Feb 14)
- St. Patrick's Day (Mar 17)
- April Fools (Apr 1)
- Easter (Good Friday, Easter Monday)
- Bank Holidays (May, August)
- Solstices (Jun 21, Dec 21)
- Halloween (Oct 31)
- Bonfire Night (Nov 5)
- Christmas period (Dec 24-26)
- New Year's Eve (Dec 31)

### seasonal_tags

Object mapping seasons to thematic tags.

```json
{
  "spring": ["spring_weather", "lighter_evenings", "renewal"],
  "summer": ["summer_weather", "long_evenings", "outdoor_work"],
  "autumn": ["autumn_weather", "darker_evenings", "cozy_indoors"],
  "winter": ["winter_weather", "dark_evenings", "cold_weather"]
}
```

- **Keys**: Season names (`spring`, `summer`, `autumn`, `winter`)
- **Values**: Arrays of season-appropriate tag strings
- Automatically applied based on current month
- Aligned with season definitions in `station.json`

### topic_categories

Object grouping related tags for organization.

```json
{
  "work": ["remote_work", "work_from_home", "video_calls"],
  "time_of_day": ["morning_routine", "lunch_break", "end_of_day"],
  "mood": ["focus_time", "procrastination", "contemplative"],
  "lofield_specific": ["lofield_lore", "roadworks", "the_hub"],
  "relatable": ["petty_grievances", "minor_frustrations"],
  "ambient": ["rainy_weather", "nature_sounds", "cafe_sounds"]
}
```

- **Keys**: Category names
- **Values**: Arrays of tag strings from allowed_topic_tags
- Used for tag suggestions and organization
- Helps with request classification
- A tag can appear in multiple categories

### notes

Array of usage and implementation notes.

```json
[
  "Allowed tags should be used for classifying listener requests and show topics",
  "Banned tags trigger automatic filtering in the moderation system"
]
```

## Adding New Tags

### Adding an Allowed Tag

1. Choose a descriptive, specific name in snake_case
2. Ensure it aligns with Lofield FM content guidelines
3. Verify it's not already covered by existing tags
4. Add to the `allowed_topic_tags` array
5. Optionally add to appropriate category in `topic_categories`
6. If seasonal, add to relevant season in `seasonal_tags`

### Adding a Banned Tag

1. Identify the prohibited topic or content type
2. Use clear, specific naming
3. Add to the `banned_topic_tags` array
4. Document why it's banned (internal notes)
5. Update moderation system to check for new tag

### Adding a Holiday

1. Determine the ISO date (YYYY-MM-DD)
2. Create descriptive tag(s) for the holiday
3. Add to `holiday_tags` object with date as key
4. Update for multiple years as needed
5. Document how shows should reference it (low-key, understated)

## Tag Naming Conventions

- Use snake_case: `remote_work`, not `RemoteWork` or `remote-work`
- Be specific: `afternoon_slump` not just `afternoon`
- Avoid redundancy: `lofi_vibes` not `lofi_music_vibes`
- Keep it simple: `coffee` not `coffee_drinking_activity`
- Use present tense or noun form: `focus_time` not `focusing`

## Validation Rules

1. All tags must be unique within their array
2. Tags must use snake_case format
3. Holiday dates must be valid ISO format (YYYY-MM-DD)
4. Holiday tags should exist in allowed_topic_tags
5. Seasonal tags should exist in allowed_topic_tags
6. Topic category tags must exist in allowed_topic_tags
7. No tag should appear in both allowed and banned lists

## Usage in System

### Request Classification

When a listener submits a request:
1. Extract keywords from request text
2. Match keywords to allowed tags
3. Check for any banned tags
4. Reject if banned tags detected
5. Classify request based on matched allowed tags
6. Use classification for scheduling and prioritization

### Show Content

Shows reference tags in `primary_tags` field:
- Guides the type of requests to play
- Influences presenter commentary topics
- Helps match content to show vibe

### Seasonal Context

Based on current date:
1. Determine current season from month
2. Apply seasonal_tags for that season
3. Check holiday_tags for today's date
4. Pass relevant tags to LLM for context-aware scripts

## Content Guidelines

### Allowed Tags Should:
- Relate to remote work, productivity, or daily life
- Be work-safe and appropriate for background listening
- Align with the station's dry, understated tone
- Help classify music requests accurately

### Banned Tags Should:
- Prevent inappropriate or off-topic content
- Protect against controversial or divisive subjects
- Maintain the station's editorial standards
- Cover both explicit prohibitions and editorial boundaries

## Example

See `config/tags.json` for complete working example with full tag lists.

## Notes

- Tag system is designed for flexibility and extension
- New tags can be added without breaking existing functionality
- Tags inform but don't strictly control content generation
- The LLM uses tags as guidance, not strict rules
- Holiday references should be understated per style guide
- Seasonal tags help maintain temporal awareness
