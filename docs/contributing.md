# Contributing to Lofield FM

Thank you for your interest in contributing to Lofield FM! This guide will help you understand how to propose changes, submit bug fixes, and contribute to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Proposing New Shows](#proposing-new-shows)
- [Updating Documentation](#updating-documentation)
- [Reporting Bugs](#reporting-bugs)
- [Submitting Code Changes](#submitting-code-changes)
- [Style Guidelines](#style-guidelines)

---

## Code of Conduct

Lofield FM is a project about dry humour and self-deprecating wit, but we expect contributors to be respectful and professional. In short:

- Be kind to other contributors
- Assume good intent
- Provide constructive feedback
- No harassment, discrimination, or aggressive behaviour

We're all just trying to make it through the day. Let's make it easier, not harder, for each other.

---

## How Can I Contribute?

There are several ways to contribute to Lofield FM:

- **Propose new shows or schedule changes** (see [Proposing New Shows](#proposing-new-shows))
2. **Update or improve documentation** (style guide, town bible, etc.)
3. **Report bugs or technical issues** (see [Reporting Bugs](#reporting-bugs))
4. **Submit code fixes or improvements** (see [Submitting Code Changes](#submitting-code-changes))
5. **Suggest new Lofield landmarks or running jokes**
6. **Improve AI prompts and content generation logic**
7. **Add new allowed tags or modify moderation thresholds** (see [Moderation and Classification](#moderation-and-classification))

---

## Proposing New Shows

Want to add a new show to the schedule? Here's how:

### 1. Check the Schedule

Review [docs/schedule.md](schedule.md) to see the current lineup. Make sure your proposed show fills a gap or replaces a time slot that could be improved.

### 2. Define Your Show

Include the following in your proposal:

- **Name**: What's the show called?
- **Time Slot**: When does it air? (must fit the 3-hour block structure)
- **Mood**: What's the vibe? (calm, energetic, contemplative, etc.)
- **Music-to-Talk Ratio**: How much music vs. talk? (typically 40-60% talk, music no more than 60%)
- **Typical Topics**: What will the presenters talk about?
- **Presenter Names**: Suggest names for the duo (should be gender-neutral and not overly quirky)
- **Seasonal Considerations**: Does the show change with seasons or holidays?

### 3. Follow the Style Guide

Make sure your show concept aligns with the [style guide](style_guide.md). No motivational speeches, no politics, no health advice. Dry, self-deprecating, relatable.

### 4. Submit a Proposal

Open an issue or pull request with your show concept. Include:

- A detailed description of the show
- Example presenter commentary (2-3 sample scripts)
- How it fits into the overall schedule

We'll review it and discuss whether it fits the station vibe.

---

## Updating Documentation

Found a typo? Want to add a new Lofield landmark? Here's how:

### Style Guide Updates

If you want to add new guidelines or examples to [docs/style_guide.md](style_guide.md):

1. Make sure the addition aligns with the existing tone
2. Provide clear examples (both good and bad, if applicable)
3. Keep it concise—bullet points are your friend

### Town Bible Updates

To add a new landmark, running joke, or location to [docs/town_bible.md](town_bible.md):

1. Make sure it fits the vibe of Lofield (small British town, remote work culture, mild absurdity)
2. Include a brief description and potential usage examples
3. Don't overexplain—let the joke breathe

### Schedule Updates

To modify [docs/schedule.md](schedule.md):

1. Ensure the overall structure (eight 3-hour shows) remains consistent
2. Keep the music-to-talk ratios within guidelines (40-60% talk, max 60% music)
3. Maintain the tone and style of existing shows

### Architecture Updates

To update [docs/architecture.md](architecture.md):

1. Ensure technical accuracy
2. Keep explanations high-level but clear
3. Update diagrams if the data flow changes

---

## Reporting Bugs

Found a bug? Here's how to report it:

### Before Reporting

1. Check existing issues to see if it's already been reported
2. Verify the bug is reproducible (try it more than once)
3. Gather relevant details (error messages, logs, steps to reproduce)

### Submitting a Bug Report

Open an issue with the following information:

- **Title**: Brief, clear description of the bug
- **Description**: What happened? What did you expect to happen?
- **Steps to Reproduce**: How can we recreate the bug?
- **Environment**: What browser, OS, or device are you using?
- **Logs/Screenshots**: Include any relevant error messages or screenshots

**Example**:
```
Title: Playout engine skips tracks at show handover

Description:
At the 18:00 handover between Afternoon Survival Session and Commute to Nowhere, the playout engine sometimes skips the first track of the new show and goes straight to presenter commentary.

Steps to Reproduce:
1. Listen to the station at 17:55
2. Wait for the 18:00 handover
3. Observe that the first Commute to Nowhere track is missing

Environment: Chrome on macOS, listening via web player

Logs: [attach relevant logs]
```

---

## Submitting Code Changes

Want to fix a bug or add a feature? Here's the process:

### 1. Fork and Clone

1. Fork the repository
2. Clone your fork locally
3. Create a new branch for your changes

```bash
git clone https://github.com/your-username/lofield.git
cd lofield
git checkout -b fix-playout-skip-bug
```

### 2. Make Your Changes

- Keep changes focused and minimal
- Follow existing code style and conventions
- Add comments if the logic is complex
- Update documentation if your changes affect user-facing behaviour

### 3. Test Your Changes

- Run existing tests (if any)
- Manually test your changes
- Ensure you haven't broken existing functionality

### 4. Commit and Push

- Write clear, descriptive commit messages
- Reference related issues in your commits

```bash
git add .
git commit -m "Fix playout engine skipping tracks at handover"
git push origin fix-playout-skip-bug
```

### 5. Open a Pull Request

- Provide a clear title and description
- Explain what the change does and why it's needed
- Reference any related issues (e.g., "Fixes #42")
- Be responsive to feedback during code review

---

## Style Guidelines

### Documentation Style

- **Short paragraphs**: Keep it scannable
- **Bullet points**: Use them liberally
- **Headings**: Structure your documents clearly
- **Tone**: Follow the Lofield FM voice (dry, self-aware, matter-of-fact)
- **Examples**: Provide examples where helpful

### Code Style

- Follow the existing style of the codebase
- Use meaningful variable and function names
- Comment complex logic, but don't over-comment obvious code
- Keep functions focused and single-purpose

### Commit Message Style

- Use present tense ("Add feature" not "Added feature")
- Keep the first line under 50 characters
- Provide additional context in the commit body if needed

**Good commit messages**:
```
Fix playout engine handover timing
Add new landmark to town bible
Update style guide with seasonal references
```

**Bad commit messages**:
```
Fixed stuff
Update
WIP
```

---

## Moderation and Classification

Lofield FM uses AI-powered moderation and classification to ensure user-submitted requests are safe, appropriate, and aligned with the station's voice. If you want to extend or modify this system:

### Adding New Allowed Tags

1. **Update `config/tags.json`**: Add the new tag to the `allowed_topic_tags` array
2. **Update `web/lib/classification.ts`**: Add the tag to the `ALLOWED_TAGS` constant
3. **Validate configuration**: Run `python3 scripts/validate_config.py`
4. **Test**: Submit a test request that should trigger the new tag

**Example**:
```json
// In config/tags.json
{
  "allowed_topic_tags": [
    "remote_work",
    "your_new_tag",
    ...
  ]
}
```

```typescript
// In web/lib/classification.ts
const ALLOWED_TAGS = [
  "remote_work",
  "your_new_tag",
  ...
];
```

### Modifying Moderation Rules

To add new banned topics or adjust moderation thresholds:

1. **Edit `web/lib/moderation.ts`**: Add new regex patterns or checks
2. **Add appropriate error messages**: Explain why the content is rejected
3. **Test thoroughly**: Ensure the new rules don't reject valid content
4. **Update documentation**: Add examples to `docs/moderation.md`

**Example**:
```typescript
// Check for cryptocurrency promotion
if (lowerText.match(/\b(nft|defi|blockchain|web3)/i)) {
  foundBannedTopics.push("crypto_promotion");
  reasons.push("Cryptocurrency promotion is not allowed");
}
```

### Testing Moderation Changes

```bash
# Test with a sample request
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d '{"type":"music","text":"Your test request here"}'
```

### Adjusting Classification Logic

To improve how requests are classified:

1. **Edit the system prompt** in `web/lib/classification.ts`
2. **Adjust temperature** for more/less creative interpretations
3. **Modify fallback logic** for when the API is unavailable
4. **Test with various request types**

### Important Notes

- **Fail open**: Moderation and classification fail open (allow content) if the API is unavailable to prevent service disruptions
- **Rate limits**: Be mindful of OpenAI API rate limits when testing
- **API keys**: Never commit API keys; use `.env` files
- **Cost**: Each request incurs API costs; optimize prompts where possible

For detailed documentation, see [docs/moderation.md](moderation.md).

---

## Proposing Major Changes

If you want to propose a significant change to the project (e.g., a new architecture component, a major refactor, a change to the core concept), please:

1. Open an issue to discuss it first
2. Provide a clear rationale for the change
3. Consider the impact on existing functionality
4. Be open to feedback and iteration

Major changes require more discussion and consensus than minor bug fixes.

---

## Questions?

If you have questions about contributing, feel free to:

- Open an issue with the "question" label
- Review existing issues and discussions
- Check the documentation in the `docs/` folder

---

## Recognition

Contributors who make significant or consistent contributions to Lofield FM may be recognized in the project documentation. Because everyone deserves a shout-out, even if they're just fixing typos.

---

*Thank you for contributing to Lofield FM. We appreciate you.*
