# Copilot Instructions for Lofield FM

This document provides context and guidelines for GitHub Copilot when working on the Lofield FM repository.

## Project Overview

Lofield FM is an experimental AI-powered radio station that combines AI-generated lofi music, AI presenters with distinct personalities, and a consistent fictional world. The station runs 24/7 with a rotating schedule of shows, each with its own vibe and talk-to-music ratio.

**Key Concept**: Background noise for people just trying to make it through the day—dry, self-deprecating humor focused on remote work culture.

## Repository Structure

```
lofield/
├── web/                      # Next.js 16 frontend application
│   ├── app/                 # Next.js app directory (routes, layouts, components)
│   ├── lib/                 # Utilities and helpers
│   └── public/              # Static assets
├── config/                   # Station configuration files (JSON)
│   ├── station.json         # Global station settings
│   ├── presenters.json      # All 16 presenter definitions (8 duos)
│   ├── tags.json            # Topic and holiday tags
│   └── shows/               # 8 individual show configurations (3 hours each)
├── schemas/                  # Configuration schema documentation
├── scripts/                  # Validation and utility scripts
│   └── validate_config.py   # Configuration validator
└── docs/
    ├── architecture.md       # Technical pipeline overview
    ├── contributing.md       # Contribution guidelines
    ├── schedule.md           # 24-hour programming schedule
    ├── style_guide.md        # Voice, tone, and content guidelines
    └── town_bible.md         # Lofield town lore and landmarks
```

## Development Setup

### Frontend Development (Next.js)

**Working Directory**: Always use `web/` as the working directory for frontend tasks.

**Installation**:
```bash
cd web
npm install
```

**Development Server**:
```bash
cd web
npm run dev
```
Opens at http://localhost:3000

**Building**:
```bash
cd web
npm run build
npm start  # Production mode
```

**Linting**:
```bash
cd web
npm run lint
```

**Formatting**:
```bash
cd web
npm run format  # Auto-fix with Prettier
```

**CI Validation** (what GitHub Actions runs):
```bash
cd web
npm ci                  # Clean install
npm run lint           # ESLint
npx prettier --check "**/*.{ts,tsx,js,jsx,json,css,md}"  # Format check
npm run build          # Build verification
```

### Configuration Validation

**Validate all JSON configuration**:
```bash
python3 scripts/validate_config.py
```

This validates:
- JSON syntax correctness
- Cross-reference consistency (presenter IDs, topic tags)
- Music ratio requirements (music capped at 60%, talk minimum 40%)
- Schedule coverage (24-hour period with no gaps)
- AI budget alignment

## Code Style and Standards

### Frontend (TypeScript/React)

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 with `@tailwindcss/postcss`
- **Linter**: ESLint with Next.js config + Prettier
- **Formatter**: Prettier

**Key Conventions**:
- Use TypeScript for type safety
- Follow existing component structure in `app/` and `lib/`
- Use Tailwind CSS for styling (no CSS modules)
- Keep components focused and single-purpose
- Follow Next.js 16 app directory patterns (Server Components by default)

### Configuration Files (JSON)

- **Format**: Strict JSON (no trailing commas, valid syntax)
- **Validation**: Always run `python3 scripts/validate_config.py` after changes
- **Cross-references**: Presenter IDs and tags must exist in their respective files
- **Music Ratios**: Music capped at 60% maximum, talk must be at least 40%
- **Schedule**: 8 shows × 3 hours each = 24-hour coverage

### Documentation (Markdown)

- **Tone**: Follow Lofield FM voice (dry, understated, self-aware)
- **Structure**: Use clear headings and bullet points
- **Style**: Short paragraphs, scannable format
- **Examples**: Provide examples where helpful

## Voice and Tone Guidelines

**Critical**: Lofield FM has a distinctive voice that must be maintained:

✅ **DO**:
- Dry and understated humor
- Self-deprecating tone
- Reference remote work pain points (bad Wi-Fi, endless meetings)
- Mention Lofield landmarks and running jokes
- Keep it relatable and matter-of-fact
- Acknowledge the AI aspect (we don't pretend to be human)

❌ **DON'T**:
- Motivational speeches or "you can do it!" energy
- Health or medical advice
- Politics or divisive topics
- Cruel or mean-spirited humor
- Explicit content
- Pretend AI has personal experiences or feelings
- Outdated slang or trying too hard to be cool

**Example Good Humor**:
> "That was 'Rainfall on a Tuesday,' requested by Sarah in Sheffield. Sarah, we hope your Wi-Fi is holding up. Statistically speaking, it probably isn't."

**Example Bad Humor**:
> "Let's crush this Monday, team!" ❌ (Too motivational)

See `docs/style_guide.md` for comprehensive guidelines.

## Configuration System

### Key Rules

1. **Music Ratios**: Music is capped at 60% maximum. Talk must be at least 40%.
2. **Schedule**: 8 shows × 3 hours = 24-hour coverage (no gaps, no overlaps)
3. **Presenters**: 16 total presenters in 8 duos (each duo hosts one show)
4. **Tags**: All topic tags used in shows must exist in `config/tags.json`
5. **Validation**: Always run `python3 scripts/validate_config.py` before committing

### Show Configuration

Each show in `config/shows/*.json` includes:
- Show identity (ID, name, description)
- Schedule (days, times, duration)
- Music/talk ratios (music ≤ 60%, talk ≥ 40%)
- Presenter duo assignment
- Tone and energy level
- Primary topics and banned tags
- Commentary style guidelines
- Handover settings (5 minutes)
- Seasonal/holiday overrides
- AI budget allocations

## Testing and Validation

### Before Committing

1. **Frontend changes**: Run linting and build
   ```bash
   cd web
   npm run lint
   npm run format
   npm run build
   ```

2. **Configuration changes**: Validate JSON
   ```bash
   python3 scripts/validate_config.py
   ```

3. **Documentation changes**: Verify tone matches style guide

### CI/CD

GitHub Actions workflow (`.github/workflows/frontend-ci.yml`) runs on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches
- Only when `web/**` files change

The workflow:
1. Sets up Node.js 20
2. Installs dependencies (`npm ci`)
3. Runs ESLint (`npm run lint`)
4. Checks Prettier formatting
5. Builds the project (`npm run build`)

## Common Tasks

### Adding a New Show

1. Read `docs/schedule.md` to understand the schedule structure
2. Review `docs/style_guide.md` for voice and tone
3. Check `schemas/` for configuration schema
4. Create new show JSON in `config/shows/`
5. Ensure music ≤ 60%, talk ≥ 40%
6. Reference valid presenter IDs and tags
7. Run `python3 scripts/validate_config.py`

### Modifying Presenter Personalities

1. Edit `config/presenters.json`
2. Maintain the dry, understated tone
3. Keep personalities distinct but aligned with station voice
4. Validate with `python3 scripts/validate_config.py`

### Updating Frontend Components

1. Work in `web/` directory
2. Follow existing component patterns
3. Use TypeScript and Tailwind CSS
4. Test locally with `npm run dev`
5. Run `npm run lint` and `npm run build`

### Adding Documentation

1. Follow the tone in existing docs
2. Keep it scannable (bullet points, short paragraphs)
3. Maintain the Lofield FM voice
4. Update relevant indexes if adding new files

## Important Files to Review

- **Style Guide**: `docs/style_guide.md` - Voice, tone, content guidelines
- **Contributing**: `docs/contributing.md` - Contribution process
- **Town Bible**: `docs/town_bible.md` - Lofield lore and running jokes
- **Architecture**: `docs/architecture.md` - Technical overview
- **Schedule**: `docs/schedule.md` - 24-hour programming schedule
- **Config README**: `config/README.md` - Configuration system overview

## Dependencies and Technologies

### Frontend Stack
- **Framework**: Next.js 16.0.3 (App Router)
- **React**: 19.2.0
- **TypeScript**: v5
- **Styling**: Tailwind CSS v4
- **Linting**: ESLint + Prettier
- **Utilities**: class-variance-authority, clsx, tailwind-merge

### Development Tools
- **Node.js**: 20 (as per CI configuration)
- **Package Manager**: npm (with package-lock.json)
- **Python**: 3.x (for config validation)

## Security and Best Practices

- Validate all JSON configuration before committing
- Run linters and formatters before pushing
- Test builds locally before opening PRs
- Maintain type safety in TypeScript
- Follow Next.js best practices for performance
- Keep dependencies up to date
- Don't commit sensitive data or credentials

## Getting Help

- Check existing documentation in `docs/`
- Review configuration examples in `config/shows/`
- Look at existing components in `web/app/`
- Read the contributing guide: `docs/contributing.md`
- Validate configuration: `python3 scripts/validate_config.py`

---

*Lofield FM: Now playing on a frequency that probably doesn't exist.*
