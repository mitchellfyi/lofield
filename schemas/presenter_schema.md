# Presenter Configuration Schema

## File: `config/presenters.json`

Defines all radio presenters with their voice profiles, roles, personalities, and show assignments.

## Schema Structure

### Root Object

```json
{
  "presenters": array of presenter objects,
  "voice_profiles": object
}
```

## Field Definitions

### presenters Array

Array of presenter objects, each representing one AI presenter.

### Presenter Object

```json
{
  "id": string,
  "name": string,
  "voice_id": string,
  "role": string,
  "persona": string,
  "shows": array of strings,
  "quirks": array of strings
}
```

#### Fields

- **id** (string, required): Unique presenter identifier
  - Lowercase, no spaces
  - Used to reference presenters in show configs
  - Example: `"alex"`

- **name** (string, required): Presenter display name
  - Proper case
  - Used in scripts and credits
  - Example: `"Alex"`

- **voice_id** (string, required): TTS voice profile identifier
  - Maps to specific voice in TTS system
  - Example: `"voice_alex_contemplative"`
  - Must be unique across all presenters

- **role** (string, required): Presenter function
  - Valid values: `"anchor"`, `"sidekick"`, `"producer"`
  - Anchor: Primary presenter, leads segments
  - Sidekick: Secondary presenter, supports anchor
  - Producer: Behind-scenes voice (rare)

- **persona** (string, required): Character description
  - Brief description of presenter's personality
  - Example: `"Contemplative, comfortable with silence, slightly philosophical at 2am"`
  - Should align with Lofield FM's core tone while allowing variation

- **shows** (array, required): Show IDs where this presenter appears
  - References show IDs from `config/shows/*.json`
  - Example: `["night_shift"]`
  - Most presenters appear on only one show

- **quirks** (array, optional): Distinctive characteristics
  - Behavioral patterns or speech habits
  - Example: `["Often pauses mid-sentence", "Comfortable acknowledging the surreal"]`
  - Used to guide script generation for authenticity

### voice_profiles Object

Metadata about voice configuration.

```json
{
  "description": string,
  "notes": array of strings
}
```

- **description** (string, optional): Voice system explanation

- **notes** (array, optional): Voice selection guidelines
  - Example: `"Each presenter has a distinct voice to maintain variety"`

## Presenter Roles

### Anchor

Primary presenter who:
- Leads show segments
- Introduces most tracks
- Handles longer commentary
- Sets the show's tone

### Sidekick

Supporting presenter who:
- Provides contrast to anchor
- Delivers complementary commentary
- Often handles one-liners
- Creates duo dynamic

### Producer

Rare role for:
- Station announcements
- Behind-scenes commentary
- Meta references
- Special segments

## Voice ID Conventions

Voice IDs should follow the pattern: `voice_{presenter_id}_{characteristic}`

Examples:
- `voice_alex_contemplative`
- `voice_morgan_resigned`
- `voice_taylor_focused`

The characteristic should hint at the voice's tone or quality to help with TTS configuration.

## Validation Rules

1. All `id` values must be unique
2. All `name` values must be unique
3. All `voice_id` values must be unique
4. `role` must be one of: `"anchor"`, `"sidekick"`, `"producer"`
5. All show IDs in `shows` array must exist in `config/shows/`
6. Each show should have exactly 2 presenters assigned to it
7. Each duo should have 1 anchor and 1 sidekick

## Duo Pairings

Presenters are typically paired in duos for shows. Each duo should:

- Have complementary personas
- Have distinct but compatible voices
- Include one anchor and one sidekick
- Maintain the show's intended energy level
- Share the core Lofield FM tone

## Current Duos

Based on the schedule:

1. **Night Shift** (00:00-03:00): Alex (anchor) + Sam (sidekick)
2. **Early Hours** (03:00-06:00): Jordan (anchor) + Casey (sidekick)
3. **Morning Commute** (06:00-09:00): Morgan (anchor) + Riley (sidekick)
4. **Mid-Morning Focus** (09:00-12:00): Taylor (anchor) + Drew (sidekick)
5. **Lunchtime Wind-Down** (12:00-15:00): Avery (anchor) + Reese (sidekick)
6. **Afternoon Push** (15:00-18:00): Quinn (anchor) + Sage (sidekick)
7. **Evening Wind-Down** (18:00-21:00): Rowan (anchor) + Finley (sidekick)
8. **Late Evening** (21:00-00:00): Harper (anchor) + River (sidekick)

## Adding a New Presenter

To add a new presenter:

1. Choose a unique, short, gender-neutral first name
2. Assign a unique `id` (lowercase version of name)
3. Create a unique `voice_id` following the naming convention
4. Define their `role` based on intended function
5. Write a `persona` that fits Lofield FM's tone while being distinct
6. Assign to appropriate `shows`
7. Add relevant `quirks` to guide script generation
8. Ensure voice profile will be available in TTS system
9. Test that the new presenter fits with their duo partner

## Persona Guidelines

Personas should:

- Align with the core Lofield FM voice (dry, self-aware, gently sardonic)
- Match the energy level of their assigned show
- Be distinct enough to feel like different presenters
- Avoid stereotypes or caricatures
- Be simple enough for consistent LLM generation
- Work well with their duo partner

Good persona examples:
- "Contemplative, comfortable with silence"
- "Gentle, not quite awake yet"
- "Resigned acceptance, light energy without being annoying"
- "Calm, focused, respects concentration time"

Avoid:
- Overly complex personalities
- Contradictory traits
- Characteristics that clash with station tone
- Personas that require specific cultural knowledge

## Voice Selection

When configuring TTS voices:

- Choose natural-sounding voices
- Ensure voices are distinct enough to differentiate presenters
- Match voice tone to persona (calm voice for focused shows, etc.)
- Test that duo voices work well together
- Avoid extreme or comedic voices
- Prefer voices that work well with the British English context

## Example

See `config/presenters.json` for a complete working example with all current presenters.

## Notes

- All current presenters are assigned to exactly one show
- Names are intentionally gender-neutral to work with various voice profiles
- Personas are deliberately understated to maintain the station's tone
- Voice IDs are placeholders until actual TTS system configuration
- Quirks should be subtle, not defining characteristics
