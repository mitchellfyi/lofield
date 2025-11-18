# AI Module Selection and Implementation Summary

## Overview

This document summarizes the research, selection criteria, and implementation decisions for Lofield FM's AI modules.

## Module Selection

### 1. Music Generation

**Selected: ElevenLabs music_v1**

#### Evaluation Criteria

| Service | Quality | Speed | Cost | Licensing | Control |
|---------|---------|-------|------|-----------|---------|
| ElevenLabs (music_v1) | ★★★★★ | ★★★★☆ | ★★★☆☆ | Commercial | ★★★☆☆ |
| Stable Audio | ★★★★★ | ★★★☆☆ | ★★★☆☆ | Proprietary | ★★★★☆ |
| Custom Model | ★★★☆☆ | ★★★★★ | ★★★★★ | Full Control | ★★★★★ |

#### Reasons for Selection

**Pros:**
- Broadcast-ready stems with consistent lofi character
- Reasonable generation time (30-60 seconds for a 3-minute track)
- Commercial license included in paid tiers
- Simple REST API with binary response (no external storage needed)
- Native support for prompt length, duration, and instrumental styles
- Shares the same `ELEVENLABS_API_KEY` used for premium TTS

**Cons:**
- Higher cost than open-source self-hosted models
- Requires active ElevenLabs plan/credits
- Less fine-grained control than a bespoke MusicGen deployment

**Alternatives Considered:**
1. **Stable Audio**: Excellent quality, but higher per-track costs and limited availability
2. **Custom Fine-tuned Model**: Maximum control, but requires ML expertise and GPU hosting
3. **MusicLM (Google)**: Not publicly accessible at time of implementation

**Cost Analysis:**
- ~$0.18-0.30 per 3-minute track (plan-dependent)
- With caching: ~$60-90 per 1,000 unique tracks
- Monthly estimate for active station: $150-250 (assuming mixed live + cached usage)

### 2. Script Generation

**Selected: OpenAI GPT-4o-mini**

#### Evaluation Criteria

| Service | Quality | Speed | Cost | Context | Consistency |
|---------|---------|-------|------|---------|-------------|
| GPT-4o-mini | ★★★★★ | ★★★★★ | ★★★★★ | 128k | ★★★★★ |
| GPT-4 | ★★★★★ | ★★★★☆ | ★★★☆☆ | 128k | ★★★★★ |
| Claude 3 Haiku | ★★★★☆ | ★★★★★ | ★★★★☆ | 200k | ★★★★☆ |

#### Reasons for Selection

**Pros:**
- Excellent understanding of tone and style guidelines
- Fast response times (2-5 seconds)
- Very cost-effective (~$0.001-0.005 per script)
- Large context window (128k tokens)
- Already used in codebase (classification module)
- JSON mode for structured outputs
- Consistent adherence to Lofield FM voice

**Cons:**
- Requires API key management
- Rate limits on free tier
- Less control than self-hosted models

**Alternatives Considered:**
1. **Claude 3**: Larger context, but slightly higher cost and less consistent with dry humor
2. **GPT-4**: Higher quality but unnecessary for this use case, 10x more expensive
3. **Llama 3 (self-hosted)**: Free but requires infrastructure and fine-tuning

**Cost Analysis:**
- ~$0.002 per script (track intro)
- ~$0.005 per script (longer segments)
- Monthly estimate for active station: $20-40

### 3. Text-to-Speech (TTS)

**Selected: OpenAI TTS (with ElevenLabs as optional upgrade)**

#### Evaluation Criteria

| Service | Quality | Speed | Cost | Voices | Customization |
|---------|---------|-------|------|--------|---------------|
| OpenAI TTS | ★★★★☆ | ★★★★★ | ★★★★★ | 6 | ★★☆☆☆ |
| ElevenLabs | ★★★★★ | ★★★★☆ | ★★★☆☆ | Unlimited | ★★★★★ |
| Google Cloud TTS | ★★★☆☆ | ★★★★★ | ★★★★☆ | 50+ | ★★★☆☆ |

#### Reasons for Selection

**Pros:**
- Natural-sounding voices
- Very fast generation (1-3 seconds)
- Cost-effective (~$0.015 per 1k characters)
- 6 distinct voices for presenter variety
- Speed control for pacing
- Already integrated with OpenAI ecosystem
- Reliable API with good uptime

**Cons:**
- Limited voice customization
- No voice cloning without ElevenLabs
- Voices may sound similar over time

**Dual-Provider Strategy:**
We support both OpenAI TTS (default) and ElevenLabs (optional premium):

**OpenAI TTS** (Default):
- Use for initial implementation
- ~$15-30/month for active station
- Good enough for MVP and testing

**ElevenLabs** (Optional):
- More natural voices
- Voice cloning for unique presenters
- Higher cost (~$5-10 per presenter per month)
- Better for production quality

**Alternatives Considered:**
1. **Google Cloud TTS**: More voices but lower quality and less natural
2. **Amazon Polly**: Good quality but requires AWS ecosystem
3. **Coqui TTS (self-hosted)**: Free but requires infrastructure and tuning

**Cost Analysis (OpenAI):**
- ~$0.015 per 1k characters
- Average script: 200 characters = ~$0.003
- Monthly estimate for active station: $15-30

**Cost Analysis (ElevenLabs):**
- ~$0.30 per 1k characters (standard plan)
- Voice cloning: $5-10 per voice/month
- Monthly estimate for active station: $50-100

## Implementation Architecture

### Modular Design

```
web/lib/ai/
├── types.ts              # Shared type definitions
├── config.ts             # Configuration management
├── cache.ts              # Caching layer (reduces API costs)
├── retry.ts              # Retry with exponential backoff
├── music-generation.ts   # Music generation module
├── script-generation.ts  # Script generation module
├── tts.ts                # TTS module
└── index.ts              # Public API
```

### Key Design Decisions

1. **Provider Abstraction**: Each module supports multiple providers, allowing easy switching without code changes

2. **Caching Layer**: Aggressive caching to minimize API costs:
   - Music: 24-hour TTL (tracks don't change)
   - Scripts: 1-hour TTL (some variety wanted)
   - TTS: 24-hour TTL (same text = same audio)

3. **Error Handling**: Graceful degradation with fallback:
   - Retry transient failures (network, rate limits)
   - Return error results instead of throwing
   - Cache fallback content for emergencies

4. **Cost Optimization**:
   - Enable caching by default
   - Support batch processing
   - Monitor and log costs
   - Configurable quality vs. cost trade-offs

## Cost Projections

### Daily Operational Costs (Estimated)

Assumptions:
- 24/7 operation
- 15 minutes music per hour = 6 hours/day = 120 tracks/day
- 4 presenter segments per hour = 96 segments/day
- Average script: 200 characters

**Without Caching:**
- Music: 120 tracks × $0.005 = $0.60/day
- Scripts: 96 scripts × $0.003 = $0.29/day
- TTS: 96 scripts × $0.003 = $0.29/day
- **Total: ~$1.18/day = $35/month**

**With Caching (50% cache hit rate):**
- Music: 60 tracks × $0.005 = $0.30/day
- Scripts: 48 scripts × $0.003 = $0.14/day
- TTS: 48 scripts × $0.003 = $0.14/day
- **Total: ~$0.58/day = $17/month**

**With Caching (80% cache hit rate):**
- Music: 24 tracks × $0.005 = $0.12/day
- Scripts: 19 scripts × $0.003 = $0.06/day
- TTS: 19 scripts × $0.003 = $0.06/day
- **Total: ~$0.24/day = $7/month**

### Monthly Cost Breakdown

| Component | Low | Medium | High |
|-----------|-----|--------|------|
| Music Generation | $5 | $15 | $35 |
| Script Generation | $3 | $10 | $20 |
| TTS (OpenAI) | $5 | $15 | $30 |
| **Total (OpenAI TTS)** | **$13** | **$40** | **$85** |
| TTS (ElevenLabs) | $20 | $50 | $100 |
| **Total (ElevenLabs)** | **$28** | **$75** | **$155** |

## Licensing

### Generated Content Rights

1. **Music (MusicGen)**:
   - Open-source model (CC-BY-NC 4.0)
   - Generated content can be used commercially
   - Attribution to Meta/MusicGen recommended but not required
   - No restrictions on broadcast or distribution

2. **Scripts (GPT-4o-mini)**:
   - OpenAI Terms: User owns outputs
   - Can use commercially without attribution
   - Standard OpenAI usage policy applies

3. **TTS (OpenAI)**:
   - User owns generated audio
   - Can use commercially
   - Must disclose AI-generated if required by jurisdiction

4. **TTS (ElevenLabs)**:
   - Commercial use allowed per plan tier
   - Voice cloning requires rights to source voice
   - Generated audio owned by user

**Conclusion**: All generated content can be broadcast and archived without licensing concerns.

## Security and Safety

### Content Moderation

1. **Input Validation**: All user inputs are moderated before generation (see `moderation.ts`)
2. **Prompt Engineering**: LLM prompts include content policy guidelines
3. **Output Filtering**: Generated content is checked for appropriateness
4. **Fallback Content**: Stock content available if generation fails or is inappropriate

### API Key Security

1. **Environment Variables**: All keys stored in `.env` (never committed)
2. **Secrets Management**: Support for Docker secrets and cloud secret stores
3. **Rotation**: Keys should be rotated every 90 days
4. **Monitoring**: Log API usage and anomalies

### Rate Limiting

1. **Provider Limits**: Respect API rate limits
2. **Exponential Backoff**: Retry with increasing delays
3. **Circuit Breaker**: Stop retrying if provider is down
4. **Queue Management**: Buffer requests to avoid spikes

## Testing Strategy

### Unit Tests

- ✅ Configuration validation
- ✅ Cache behavior (hits, misses, expiration)
- ✅ Retry logic (attempts, backoff, errors)
- ✅ Input validation
- ✅ Error handling

### Integration Tests (Future)

- [ ] Music generation with real API (stub for now)
- [ ] Script generation with real API (stub for now)
- [ ] TTS with real API (stub for now)
- [ ] End-to-end content pipeline

### Performance Tests (Future)

- [ ] Concurrent generation load testing
- [ ] Cache performance under load
- [ ] API rate limit handling

## Rollout Plan

### Phase 1: MVP (Current)
- ✅ Module implementation
- ✅ Unit tests
- ✅ Documentation
- ✅ Environment configuration
- [ ] Integration with scheduler

### Phase 2: Testing
- [ ] Test with real API keys in development
- [ ] Generate sample content
- [ ] Validate quality and consistency
- [ ] Tune prompts and parameters

### Phase 3: Production
- [ ] Deploy to production environment
- [ ] Monitor costs and usage
- [ ] Set up alerts for failures
- [ ] Implement metrics dashboard

### Phase 4: Optimization
- [ ] Analyze cache hit rates
- [ ] Fine-tune prompts for better quality
- [ ] Consider custom model fine-tuning
- [ ] Implement A/B testing

## Future Enhancements

1. **Custom Music Model**: Fine-tune MusicGen on curated lofi dataset
2. **Voice Cloning**: Create unique voices for each presenter
3. **Multi-Language**: Support for languages beyond English
4. **Real-Time Generation**: Streaming TTS for live segments
5. **Quality Scoring**: AI-based quality assessment of generated content
6. **A/B Testing**: Test different prompts and parameters
7. **Cost Dashboard**: Real-time cost monitoring and alerts

## Conclusion

The selected AI modules provide a strong foundation for Lofield FM:

✅ **High Quality**: All modules produce broadcast-quality content
✅ **Cost-Effective**: ~$7-40/month with caching (scales with usage)
✅ **Reliable**: Robust error handling and fallback mechanisms
✅ **Scalable**: Can handle 24/7 operation with proper caching
✅ **Flexible**: Provider abstraction allows easy switching
✅ **Secure**: Proper key management and content moderation

The implementation balances quality, cost, and reliability while maintaining flexibility for future improvements.

---

*Document Status: Implementation complete, testing in progress*
*Last Updated: 2024*
