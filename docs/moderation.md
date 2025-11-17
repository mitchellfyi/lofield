# Moderation and Classification System

This document describes how Lofield FM uses AI to moderate user requests and classify them into structured metadata for content generation.

## Overview

When a listener submits a request (music or talk topic), the system performs two critical steps:

1. **Moderation**: Checks if the content is safe and complies with station guidelines
2. **Classification**: Extracts structured metadata from the request for content generation

## Architecture

```
User Request → Moderation → Classification → Database → Content Generation
                   ↓              ↓
              (if rejected)   (extract metadata)
                 Return          Store in
                 Error          'normalized'
```

## Moderation

### Purpose

The moderation system ensures that all user-submitted content:
- Is safe and non-harmful
- Complies with Lofield FM's content guidelines
- Maintains the station's voice and tone

### Implementation

**Location**: `web/lib/moderation.ts`

**API Used**: OpenAI Moderation API (omni-moderation-latest model)

### Moderation Process

1. **OpenAI Content Safety Check**
   - Detects: hate speech, harassment, self-harm, sexual content, violence
   - Returns flagged categories and confidence scores

2. **Station-Specific Topic Filtering**
   - Politics and political commentary
   - Health and medical advice
   - Financial and investment advice
   - Spam, advertising, and promotional content

3. **Tone Matching**
   - Flags overly motivational or inspirational content
   - Ensures alignment with Lofield FM's dry, understated tone

### Verdicts

- **`allowed`**: Content passes all checks and can be used
- **`rejected`**: Content violates safety or content guidelines
- **`needs_rewrite`**: Content is borderline and should be reviewed/rewritten

### Configuration

**Environment Variables**:
- `OPENAI_API_KEY`: Required for OpenAI Moderation API
- `AUTO_MODERATION_ENABLED`: Set to `"false"` to disable auto-moderation (default: `"true"`)

**Fallback Behavior**: If the OpenAI API is unavailable, the system fails open and allows content to prevent service outages from blocking all requests.

## Classification

### Purpose

The classification system extracts structured metadata from user requests to enable:
- Accurate content generation (music tracks or talk segments)
- Tag-based filtering and organization
- Metadata for presenter commentary

### Implementation

**Location**: `web/lib/classification.ts`

**API Used**: OpenAI GPT-4o-mini with structured JSON output

### Classification Process

1. **Type Detection**
   - Determines if the request is a `music_prompt` or `talk_topic`
   - Uses LLM analysis with user type hint as guidance

2. **Metadata Extraction**
   - **Music prompts**: mood, tempo, energy, keywords, tags
   - **Talk topics**: core topic, tone, tags, suggested duration

3. **Normalization**
   - Rewrites the request to match Lofield FM's voice
   - Ensures consistency with style guide

4. **Tag Validation**
   - Filters extracted tags against allowed list from `config/tags.json`
   - Ensures only valid tags are stored

### Output Structure

**Music Prompt**:
```json
{
  "type": "music_prompt",
  "normalized": "Smooth lofi beats for a rainy morning coding session",
  "confidence": 0.95,
  "metadata": {
    "mood": ["calm", "focused", "rainy"],
    "tempo": "slow",
    "energy": "low",
    "keywords": ["lofi", "rain", "coding", "morning"],
    "tags": ["coding_session", "morning_routine", "rainy_day", "focus_time"]
  }
}
```

**Talk Topic**:
```json
{
  "type": "talk_topic",
  "normalized": "The eternal struggle of back-to-back video calls",
  "confidence": 0.92,
  "metadata": {
    "topic": "video call fatigue and meeting overload",
    "tone": "dry",
    "tags": ["video_calls", "meetings", "back_to_back_meetings", "meeting_fatigue"],
    "suggestedDuration": 120
  }
}
```

### Fallback Behavior

If the OpenAI API is unavailable, the system uses simple keyword-based heuristics:
- Matches common keywords to determine type
- Extracts basic tags from text
- Provides lower confidence scores
- Ensures the system remains functional

## API Integration

### Endpoint: `POST /api/requests`

**Request Body**:
```json
{
  "type": "music" | "talk",
  "text": "User request text (min 10 characters)"
}
```

**Success Response (201)**:
```json
{
  "id": "clx1234567890",
  "type": "music",
  "rawText": "Original user text",
  "normalized": "{...}",
  "votes": 0,
  "status": "pending",
  "moderationStatus": "approved",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "moderation": {
    "verdict": "allowed",
    "reasons": []
  },
  "classification": {
    "type": "music_prompt",
    "normalized": "Normalized text",
    "confidence": 0.95,
    "metadata": {...}
  }
}
```

**Moderation Rejection (403)**:
```json
{
  "error": "Request rejected by moderation",
  "reasons": [
    "Contains political content",
    "Political content is not allowed (see style guide)"
  ],
  "id": "clx1234567890"
}
```

## Examples

### Accepted Requests

✅ **Music Request**:
```
Input: "Smooth jazz for a rainy afternoon coding session"
Type: music_prompt
Normalized: "Smooth jazz for a rainy afternoon coding session"
Tags: ["coding_session", "rainy_day", "jazz_elements", "afternoon_slump"]
```

✅ **Talk Request**:
```
Input: "Let's talk about the struggle of pretending to be productive during Zoom calls"
Type: talk_topic
Normalized: "The mild absurdity of appearing productive during video calls"
Tags: ["video_calls", "pretending_to_work", "relatable_struggles"]
Tone: "dry"
```

✅ **Borderline but Accepted**:
```
Input: "Music for getting through the day"
Type: music_prompt
Normalized: "Background music for making it through the work day"
Tags: ["work_from_home", "background_noise", "chill_beats"]
```

### Rejected Requests

❌ **Political Content**:
```
Input: "Play something while I discuss the upcoming election"
Verdict: rejected
Reason: "Political content is not allowed (see style guide)"
```

❌ **Medical Advice**:
```
Input: "Music to help with my anxiety and depression symptoms"
Verdict: rejected
Reason: "Medical or health advice is not allowed (we're not qualified)"
```

❌ **Spam/Advertising**:
```
Input: "Check out my mixtape at www.example.com"
Verdict: rejected
Reason: "Promotional content, spam, or URLs are not allowed"
```

❌ **Explicit Content**:
```
Input: "Something with explicit lyrics about [inappropriate topic]"
Verdict: rejected
Reason: "Contains explicit sexual content"
```

### Flagged for Review

⚠️ **Tone Mismatch**:
```
Input: "You can do it! Motivational beats to crush your goals!"
Verdict: needs_rewrite
Reason: "Content is too motivational for Lofield FM's dry, understated tone"
Moderation Status: flagged
```

## Extending the System

### Adding New Banned Topics

1. Update the regex patterns in `web/lib/moderation.ts`
2. Add corresponding error messages
3. Document in this guide

Example:
```typescript
// Check for cryptocurrency promotion
if (lowerText.match(/\b(nft|defi|blockchain|web3|metaverse)/i)) {
  foundBannedTopics.push("crypto_promotion");
  reasons.push("Cryptocurrency promotion is not allowed");
}
```

### Adding New Tags

1. Add the tag to `config/tags.json` in the `allowed_topic_tags` array
2. Update `web/lib/classification.ts` ALLOWED_TAGS constant
3. Run validation: `python3 scripts/validate_config.py`

### Adjusting Moderation Thresholds

**OpenAI Moderation**: Cannot be adjusted (uses OpenAI's model)

**Custom Rules**: Edit the regex patterns in `moderateRequest()` function

**Disable Moderation**: Set `AUTO_MODERATION_ENABLED=false` in `.env`

### Testing Changes

```bash
# Test with a sample request
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d '{"type":"music","text":"Your test request here"}'
```

## Testing

Unit tests are located in `web/lib/__tests__/`:
- `moderation.test.ts`: Tests moderation logic
- `classification.test.ts`: Tests classification logic

Run tests with:
```bash
cd web
npm test
```

## Performance Considerations

- **Moderation**: ~100-300ms per request (OpenAI API call)
- **Classification**: ~500-1000ms per request (LLM inference)
- **Total overhead**: ~1-1.5s per request submission

**Optimization**: Both services use streaming/structured output to minimize latency.

## Security

- API keys are stored in environment variables, never in code
- Failed API calls fail open to prevent denial of service
- All user input is validated before processing
- Moderation happens before classification to prevent wasted compute
- Rejected requests are still logged for monitoring

## Monitoring

**Metrics to Track**:
- Moderation rejection rate
- Classification confidence scores
- API response times
- Fallback usage (indicates API issues)

**Logs**:
- Rejected requests are logged with reasons
- Classification errors are logged with fallback usage
- API errors are logged for debugging

## Future Improvements

- [ ] Add content similarity detection to prevent spam/duplicates
- [ ] Implement rate limiting per IP address
- [ ] Add manual review queue for flagged content
- [ ] Cache classification results for similar requests
- [ ] Add metrics dashboard for moderation statistics
- [ ] Implement progressive enhancement (client-side pre-check)
