# Streaming Architecture

This document outlines the streaming and playback engine architecture for Lofield FM.

## Technology Selection

### Streaming Protocol: HLS (HTTP Live Streaming)

**Selected Approach**: HLS (HTTP Live Streaming) over Icecast

**Rationale**:

1. **Browser Compatibility**: HLS is natively supported by modern browsers via Media Source Extensions (MSE) and works well with HTML5 `<audio>` and `<video>` elements
2. **Next.js Integration**: HLS streams are just HTTP endpoints, making them trivial to integrate with Next.js API routes
3. **Time-Shift Friendly**: HLS segments are naturally suited for time-shifted playback - we can serve different playlists pointing to archived segments
4. **No Additional Server**: Unlike Icecast, HLS doesn't require a separate streaming server - we can serve segments directly from Next.js
5. **Scalability**: HLS segments can be easily cached on CDN for better global distribution
6. **Adaptive Bitrate**: HLS supports adaptive bitrate streaming (future enhancement)

**Trade-offs**:
- **Latency**: HLS has ~6-30 second latency vs Icecast's ~2-5 seconds (acceptable for our use case)
- **Segment Management**: Need to manage segment files vs continuous stream (handled by our implementation)

### Alternative Considered: Icecast

**Pros**:
- Lower latency (2-5 seconds)
- Battle-tested for radio streaming
- Built-in metadata support

**Cons**:
- Requires separate service (more infrastructure)
- Less browser-friendly (requires additional libraries)
- Harder to implement time-shift (would need parallel recording)
- Additional configuration complexity

**Decision**: HLS provides better integration with our stack and superior time-shift capabilities.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Scheduler Service                        │
│  - Generates audio segments (music, talk, idents)          │
│  - Queues segments with timing metadata                    │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                   Playout Service                           │
│  - Consumes queued segments                                 │
│  - FFmpeg: Concatenates, crossfades, normalizes             │
│  - Outputs HLS segments (.ts files) + manifest (.m3u8)      │
└────────────┬────────────────────────────────────────────────┘
             │
             ├──────────────┬───────────────────────┐
             ▼              ▼                       ▼
    ┌─────────────┐  ┌─────────────┐      ┌─────────────┐
    │ Live Stream │  │   Archive   │      │  Metadata   │
    │  (HLS)      │  │  (Segments) │      │  (JSON)     │
    └──────┬──────┘  └──────┬──────┘      └──────┬──────┘
           │                │                     │
           ▼                ▼                     ▼
    ┌─────────────────────────────────────────────────────┐
    │              Next.js API Routes                     │
    │  /api/stream/live.m3u8  - Live HLS playlist         │
    │  /api/stream/live/*.ts  - Live HLS segments         │
    │  /api/archive/time      - Time-shift HLS playlist   │
    │  /api/archive/shows/:id - Show episode HLS playlist │
    │  /api/now-playing       - Current segment metadata  │
    └────────────┬────────────────────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────────────────────┐
    │              Frontend Audio Player                  │
    │  - HTML5 <audio> with HLS.js fallback               │
    │  - Time-shift controls (rewind, fast-forward)       │
    │  - Live/Archive mode switching                      │
    │  - Metadata display (now playing, show info)        │
    └─────────────────────────────────────────────────────┘
```

## Playout Pipeline

### FFmpeg Processing Chain

The playout service uses FFmpeg to process audio segments:

1. **Input**: Individual segment files from scheduler (music, talk, idents)
2. **Concatenation**: Stitch segments together in order
3. **Crossfading**: Apply fade-out/fade-in between segments
   - Music-to-music: 2 second crossfade
   - Music-to-talk: 1 second fade-out, immediate talk start
   - Talk-to-music: Immediate music fade-in under final words (0.5s)
4. **Volume Normalization**: Ensure consistent loudness (LUFS normalization)
5. **Volume Ducking**: Reduce music volume during voiceovers (if mixed)
6. **Output**: HLS segments (.ts files, typically 6 seconds each)

### FFmpeg Command Structure

```bash
ffmpeg -i segment1.mp3 -i segment2.mp3 -i segment3.mp3 \
  -filter_complex "
    [0:a]afade=t=out:st=177:d=2[a0];
    [1:a]afade=t=in:st=0:d=2[a1];
    [a0][a1]acrossfade=d=2[a01];
    [a01][2:a]concat=n=2:v=0:a=1[aout];
    [aout]loudnorm=I=-16:TP=-1.5:LRA=11
  " \
  -f hls \
  -hls_time 6 \
  -hls_list_size 10 \
  -hls_flags delete_segments \
  -hls_segment_filename '/var/lofield/stream/live%03d.ts' \
  /var/lofield/stream/live.m3u8
```

### Crossfade Configuration

Crossfade durations are configurable per show or globally via environment variables:

- Default music-to-music: 2 seconds (`CROSSFADE_MUSIC_TO_MUSIC`)
- Default music-to-talk: 1 second (`CROSSFADE_MUSIC_TO_TALK`)
- Default talk-to-music: 0.5 seconds (`CROSSFADE_TALK_TO_MUSIC`)

**Environment Variable Configuration:**
```bash
# In services/playout/.env
CROSSFADE_MUSIC_TO_MUSIC=2.0
CROSSFADE_MUSIC_TO_TALK=1.0
CROSSFADE_TALK_TO_MUSIC=0.5
```

**Current Implementation:**
The HLS manager implements crossfading using FFmpeg's `afade` filter for smooth transitions between segments. The crossfade duration is automatically selected based on the types of adjacent segments (music, talk, ident, handover).

**Trade-offs:**
- Crossfading adds processing overhead during segment encoding
- Longer crossfades provide smoother transitions but may overlap content
- Very short crossfades (< 0.5s) may sound abrupt on some audio material
- Crossfading is applied during HLS segment generation, not in real-time

## Live Streaming

### HLS Manifest Generation

The playout service continuously generates HLS manifests (`.m3u8` files):

```m3u8
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:1234
#EXTINF:6.0,
live001.ts
#EXTINF:6.0,
live002.ts
#EXTINF:6.0,
live003.ts
```

### Live Stream Endpoint

`GET /api/stream/live.m3u8`
- Returns the current HLS manifest
- Manifest points to latest 10 segments (~60 seconds of audio)
- Segments auto-delete after being replaced (sliding window)

`GET /api/stream/live/:segment.ts`
- Serves individual HLS segment files
- Cached with appropriate headers for performance

### Encoding Settings

- **Container**: MPEG-TS (.ts files)
- **Audio Codec**: AAC-LC (best browser compatibility)
- **Sample Rate**: 48 kHz
- **Bitrate**: 128 kbps (good quality for lofi)
- **Channels**: Stereo
- **Segment Duration**: 6 seconds (balance between latency and overhead)

## Time-Shift and Archive

### Archive Recording

As the playout service generates live HLS segments, it also:
1. Copies segments to archive storage
2. Organizes by timestamp: `/archive/2024/01/15/14/live_140000.ts`
3. Maintains an index mapping timestamps to segment files

### Archive Index Structure

```json
{
  "timestamp": "2024-01-15T14:00:00Z",
  "segmentPath": "/archive/2024/01/15/14/live_140000.ts",
  "duration": 6.0,
  "showId": "deep-work",
  "segmentType": "music",
  "trackId": "track_abc123"
}
```

### Time-Shift Playlist Generation

`GET /api/archive/time?ts=2024-01-15T14:00:00Z`

Generates an HLS playlist starting at the specified timestamp:

```m3u8
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:EVENT
#EXTINF:6.0,
/api/archive/segments/2024/01/15/14/live_140000.ts
#EXTINF:6.0,
/api/archive/segments/2024/01/15/14/live_140006.ts
#EXTINF:6.0,
/api/archive/segments/2024/01/15/14/live_140012.ts
```

### Show Episode Assembly

`GET /api/archive/shows/:showId?date=2024-01-15`

Assembles a complete show episode from archived segments:

1. Query database for show's time range on specified date
2. Retrieve all archived segments for that time range
3. Generate HLS playlist with all segments in order
4. Optional: Pre-generate single MP3 file for download

## Metadata and "Now Playing"

### Real-Time Metadata

The playout service publishes metadata as segments play:

```json
{
  "segmentId": "seg_abc123",
  "type": "music",
  "startTime": "2024-01-15T14:00:00Z",
  "endTime": "2024-01-15T14:03:30Z",
  "showName": "Deep Work (According to Calendar Blocks)",
  "showId": "deep-work",
  "presenters": ["morgan", "riley"],
  "track": {
    "title": "Rainy Coding Session",
    "artist": "Lofield FM",
    "requestText": "Rainy day coffee shop vibes"
  }
}
```

### Frontend Integration

The audio player subscribes to metadata updates via:
- Server-Sent Events (SSE) at `/api/events`
- Polling `/api/now-playing` every 10 seconds (fallback)

## Frontend Player Implementation

### Technology Stack

- **HLS.js**: JavaScript library for HLS playback in browsers without native support
- **Native HLS**: Use native browser support where available (Safari)
- **Fallback**: Progressive MP3 download for very old browsers

### Player Features

1. **Play/Pause**: Standard audio controls
2. **Volume Control**: Mute and volume slider
3. **Live Indicator**: Visual indicator when playing live stream
4. **Time-Shift Slider**: Scrub back up to 24 hours
5. **"Go Live" Button**: Jump back to live stream
6. **Show Navigation**: Skip to previous/next show
7. **Metadata Display**: 
   - Now playing track title
   - Show name
   - Presenter names
   - Requester info

### Time-Shift Implementation

When user drags the time-shift slider:
1. Calculate timestamp (current time - minutes back)
2. Request HLS playlist for that timestamp
3. Load new playlist into player
4. Update UI to show "archive mode"
5. Disable live indicator

When user clicks "Go Live":
1. Request live HLS playlist
2. Load into player
3. Update UI to show "live mode"
4. Enable live indicator

## Monitoring and Resilience

### Health Checks

`GET /api/health/stream`
```json
{
  "status": "healthy",
  "playoutService": "running",
  "liveStreamAge": 3,
  "queueDepth": 45,
  "lastSegmentAt": "2024-01-15T14:00:00Z",
  "archiveStorage": {
    "available": "150GB",
    "used": "50GB"
  }
}
```

### Failure Handling

1. **Playout Service Crash**: Systemd/PM2 auto-restart
2. **Scheduler Queue Empty**: Fall back to pre-generated loop (emergency content)
3. **FFmpeg Error**: Skip problematic segment, log error, continue with next
4. **Disk Full**: Alert, clean up old archives, continue streaming

### Pre-Generated Fallback Loop

A 30-minute emergency loop of lofi music + generic idents:
- Used when scheduler fails or queue runs dry
- Continuously loops until scheduler recovers
- Logged prominently for monitoring

## Storage and Retention

### Live Stream Storage

- Location: `/var/lofield/stream/`
- Segments: Rolling window of last 10 segments (~60 seconds)
- Auto-cleanup: Old segments deleted automatically

### Archive Storage

- Location: `/var/lofield/archive/YYYY/MM/DD/HH/`
- Retention: 30 days (configurable via `ARCHIVE_RETENTION_DAYS`)
- Daily cleanup job removes segments older than retention period
- Estimated storage: ~2 GB per day (128 kbps * 24 hours)
- Cleanup runs in parallel with concurrency control (10 concurrent deletions)
- Empty directories are automatically removed after cleanup

**Environment Variable Configuration:**
```bash
# In services/playout/.env
ARCHIVE_RETENTION_DAYS=30  # Keep archives for 30 days
```

### Archive Retrieval and Performance

**Sorted Segment Retrieval:**
All archive retrieval methods return segments sorted by timestamp in ascending order to ensure proper chronological playback during time-shift.

**Pagination Support:**
Archive retrieval functions support optional pagination parameters:
- `limit`: Maximum number of segments to return
- `offset`: Number of segments to skip

Example usage:
```typescript
// Get first 100 segments starting at a timestamp
const segments = await archiveManager.getSegmentsFromTimestamp(
  new Date('2024-01-15T14:00:00Z'),
  60, // duration in minutes
  100, // limit
  0   // offset
);
```

**Performance Considerations:**
- File operations use async I/O (`fs.promises.*`) to prevent blocking the event loop
- Archive cleanup uses parallel deletion with concurrency limits
- Directory cleanup removes empty archive directories after segment deletion
- Statistics gathering processes files in batches to avoid overwhelming I/O

### Database Storage

- Segment metadata: Permanent (tracks what was played)
- Playlog: Permanent (listening history)
- Archive index: Permanent (maps timestamps to files)

## Configuration Reference

The playout service can be configured via environment variables:

```bash
# Stream and Archive Paths
STREAM_OUTPUT_PATH=/var/lofield/stream      # HLS live stream output
ARCHIVE_OUTPUT_PATH=/var/lofield/archive    # Archive storage location

# HLS Settings
HLS_SEGMENT_DURATION=6                      # Segment duration in seconds
HLS_LIST_SIZE=10                            # Number of segments in manifest

# Crossfade Settings (in seconds)
CROSSFADE_MUSIC_TO_MUSIC=2.0               # Music to music transitions
CROSSFADE_MUSIC_TO_TALK=1.0                # Music to talk transitions
CROSSFADE_TALK_TO_MUSIC=0.5                # Talk to music transitions

# Audio Quality
AUDIO_BITRATE=128k                          # Output audio bitrate
AUDIO_SAMPLE_RATE=48000                     # Output sample rate (Hz)

# Service Settings
POLL_INTERVAL=5                             # Segment polling interval (seconds)
ARCHIVE_RETENTION_DAYS=30                   # Archive retention period (days)

# Logging
LOG_LEVEL=info                              # Log level: debug, info, warn, error
```

## Current Implementation Status

### Implemented Features
✅ **HLS Streaming**: Live HLS stream with configurable segment duration and playlist size  
✅ **Crossfading**: Automatic crossfading between segments based on content type  
✅ **Archive Management**: Time-based archiving with configurable retention  
✅ **Sorted Retrieval**: Archive segments returned in chronological order  
✅ **Pagination**: Limit and offset support for archive queries  
✅ **Async I/O**: Non-blocking file operations throughout  
✅ **Parallel Cleanup**: Concurrent deletion of old archives with concurrency control  
✅ **Error Handling**: Graceful error recovery without service interruption  
✅ **Loudness Normalization**: Consistent audio levels via FFmpeg filters  

### Known Limitations

⚠️ **Crossfade Implementation**: The current crossfade implementation applies fades to individual segments before concatenation. For optimal crossfading with `acrossfade`, segments would need to be loaded as separate FFmpeg inputs, which is more complex and memory-intensive.

⚠️ **Memory Usage**: Archive statistics calculation loads file metadata in batches but may still be memory-intensive for very large archives (millions of segments).

⚠️ **FFmpeg Dependency**: The service requires FFmpeg to be installed on the system with AAC encoding support.

⚠️ **Single Playout Instance**: Only one playout service instance should run per stream to avoid conflicts. For multiple streams/stations, run separate instances with different output paths.

⚠️ **No Adaptive Bitrate**: Currently outputs a single bitrate. ABR would require generating multiple quality tiers.

### Error Recovery Behavior

The playout service implements graceful error handling:

- **Missing Segments**: Logged and skipped; streaming continues with remaining segments
- **Archive Failures**: Logged but don't interrupt live streaming
- **FFmpeg Errors**: Process is cleaned up; service retries on next poll cycle
- **Disk Full**: Archive cleanup can be triggered manually; oldest files deleted first
- **Database Errors**: Logged; service continues polling on next interval

## Performance Considerations

### CDN Integration

For production:
1. Serve HLS segments through CDN (Cloudflare, CloudFront)
2. Set appropriate cache headers on segments (immutable)
3. Set short TTL on manifests (5-10 seconds)

### Segment Caching Strategy

- Live segments: `Cache-Control: public, max-age=60, immutable`
- Archive segments: `Cache-Control: public, max-age=31536000, immutable`
- Live manifest: `Cache-Control: no-cache`
- Archive manifests: `Cache-Control: public, max-age=3600`

### Scaling Considerations

- HLS segments are stateless - easy to scale horizontally
- Archive storage can use object storage (S3, R2)
- Playout service runs on single instance (stateful) - scale with multiple shows/stations

## Security Considerations

- **No DRM**: Content is openly streamable (this is a free radio station)
- **Rate Limiting**: Prevent abuse of archive endpoints
- **Hotlinking Prevention**: Optional referer check for production
- **CORS**: Configure appropriate CORS headers for streaming endpoints

## Future Enhancements

- **Adaptive Bitrate**: Multiple quality tiers (64 kbps, 128 kbps, 256 kbps)
- **Visualizer**: Real-time audio waveform visualization
- **Lyrics/Transcripts**: Display presenter scripts as they play
- **Social Features**: Share timestamps of favorite moments
- **Download Episodes**: Pre-generate MP3 files of show episodes
- **Stats**: Track listening hours, popular shows, peak times

---

*Lofield FM: Now streaming in a format that actually works.*
