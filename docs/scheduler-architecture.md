# Scheduler Service Architecture

This document provides detailed technical documentation for the Lofield FM scheduler service.

## Overview

The scheduler service is the heart of Lofield FM, orchestrating all aspects of the 24/7 broadcast. It coordinates show rotations, manages content generation, maintains the playback queue, and enables time-shifted listening through archiving.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Scheduler Service                           │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │Show Scheduler│  │Queue Manager │  │Content Gen   │         │
│  │              │  │              │  │              │         │
│  │ - Show select│  │ - Monitoring │  │ - Music gen  │         │
│  │ - Transitions│  │ - Segments   │  │ - Scripts    │         │
│  │ - Seasonal   │  │ - Stats      │  │ - TTS        │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │Archiver      │  │Broadcaster   │  │Main Loop     │         │
│  │              │  │              │  │              │         │
│  │ - Time-shift │  │ - Now playing│  │ - Scheduling │         │
│  │ - Episodes   │  │ - Queue info │  │ - Error hand │         │
│  │ - Index      │  │ - Events     │  │ - Cleanup    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   ┌──────────┐        ┌──────────┐        ┌──────────┐
   │Database  │        │AI Modules│        │Frontend  │
   │(Prisma)  │        │- Music   │        │WebSocket │
   └──────────┘        │- Scripts │        │/SSE      │
                       │- TTS     │        └──────────┘
                       └──────────┘
```

## Module Details

### 1. Show Scheduler (`show-scheduler.ts`)

**Responsibilities:**
- Determines which show is currently active based on UTC time
- Handles 24-hour schedule with 3-hour blocks
- Manages show transitions with handover segments
- Provides seasonal and holiday context

**Key Functions:**
- `getCurrentShow()`: Returns the active show for current time
- `getNextShow(currentShow)`: Gets the next show in rotation
- `getShowEndTime(show)`: Calculates when the current show ends
- `isNearShowTransition(show, threshold)`: Checks if near show boundary
- `getSeasonalContext(date)`: Returns season, month, and holiday info

**Algorithm for Show Selection:**
```
1. Get current UTC day and time
2. Convert time to minutes since midnight
3. Query all shows from database
4. For each show:
   a. Parse schedule from JSON config
   b. Check if current day matches show's days
   c. Check if current time is within show's time range
   d. Handle midnight wraparound (e.g., 21:00-03:00)
5. Return matching show or null
```

**Seasonal Detection:**
- Winter: December, January, February
- Spring: March, April, May
- Summer: June, July, August
- Autumn: September, October, November

**Holiday Detection:**
- Christmas: December 24-26
- New Year: January 1
- Halloween: October 31
- (Extensible for more holidays)

### 2. Queue Manager (`queue-manager.ts`)

**Responsibilities:**
- Monitors queue depth and triggers replenishment
- Creates and retrieves segments from database
- Tracks requests and marks them as used
- Provides queue statistics

**Key Functions:**
- `getQueuedSegments(startTime, endTime)`: Retrieves segments in time window
- `calculateQueuedMinutes(segments)`: Computes total queue duration
- `needsReplenishment(config)`: Determines if content generation is needed
- `getNextAvailableSlot()`: Finds next open time slot
- `createSegment(segment)`: Inserts segment into database
- `createTrack(track)`: Records generated track
- `markRequestAsUsed(requestId)`: Updates request status
- `getTopRequests(limit)`: Fetches highest-voted requests
- `getQueueStats(bufferMinutes)`: Returns queue metrics

**Queue Replenishment Logic:**
```
1. Calculate buffer window (now + buffer_minutes)
2. Query all segments in window
3. Sum total duration in minutes
4. If duration < min_queue_depth:
   a. Set needed = true
   b. Calculate minutes_needed
   c. Trigger content generation
```

**Queue Statistics:**
- Total segments in queue
- Total minutes of content
- Breakdown by type (music, talk, ident, handover)
- Oldest and newest segment times

### 3. Content Generator (`content-generator.ts`)

**Responsibilities:**
- Integrates AI modules for content creation
- Generates music tracks from requests
- Creates presenter commentary segments
- Produces handover and ident segments
- Provides fallback content on failure

**Key Functions:**
- `generateMusicTrack(request, show, path)`: Creates music from request
- `generateCommentary(request, show, trackTitle, path)`: Creates presenter talk
- `generateHandoverSegment(currentShow, nextShow, path)`: Creates transitions
- `generateIdent(show, path)`: Creates station IDs
- `generateFallbackContent(type, path)`: Emergency content

**Content Generation Pipeline:**
```
Music Track:
1. Get request from queue
2. Normalize prompt (stub for LLM call)
3. Generate music (stub for text-to-music API)
4. Save audio file
5. Return file path and metadata

Commentary:
1. Get show and track context
2. Generate script (stub for LLM call)
3. Convert to speech (stub for TTS API)
4. Save audio file
5. Return file path and duration

Handover:
1. Get outgoing and incoming show info
2. Get presenter duos for both shows
3. Generate handover script (stub for LLM)
4. Generate TTS for each presenter
5. Mix audio (stub)
6. Save file
7. Return path
```

**Error Handling:**
- All generation functions return success/error status
- On failure, fallback content is generated
- Errors are logged but don't stop the scheduler

### 4. Archiver (`archiver.ts`)

**Responsibilities:**
- Records broadcast into hour-long archive files
- Maintains index for time-shifted playback
- Enables jump-to-time functionality
- Assembles on-demand show episodes

**Key Functions:**
- `recordSegmentToArchive(segment, archivePath)`: Appends segment to archive
- `getArchivedSegments(startTime, endTime)`: Retrieves archived segments
- `assembleShowEpisode(showId, date, outputPath)`: Creates episode file
- `getSegmentAtTime(timestamp)`: Finds segment for specific time
- `cleanupOldArchives(archivePath, retentionDays)`: Removes old files
- `getArchiveStats()`: Returns archive metrics

**Archive File Structure:**
```
/archive/
  /2024/
    /01/
      lofield_20240115_0000.mp3  (00:00-01:00)
      lofield_20240115_0100.mp3  (01:00-02:00)
      lofield_20240115_0200.mp3  (02:00-03:00)
      ...
```

**Archive Index Structure:**
```typescript
{
  segmentId: "seg_abc123",
  filePath: "/archive/2024/01/lofield_20240115_0000.mp3",
  offset: 180000,        // Bytes from start of file
  duration: 180,         // Seconds
  startTime: Date,
  endTime: Date,
  showId: "morning_commute",
  type: "music"
}
```

**Episode Assembly:**
```
1. Query show schedule for given date
2. Calculate show start/end times
3. Find all archived segments for show
4. Extract segment data from archive files
5. Concatenate into single file
6. Save as episode (e.g., morning_commute_2024-01-15.mp3)
```

### 5. Broadcaster (`broadcaster.ts`)

**Responsibilities:**
- Publishes real-time updates via EventEmitter
- Broadcasts now playing metadata
- Streams queue updates
- Notifies on show changes
- Ready for WebSocket/SSE integration

**Key Functions:**
- `publishNowPlaying(metadata)`: Emits current segment info
- `publishQueueUpdate(segments)`: Emits upcoming segments
- `publishRequestPlayed(requestId, title)`: Notifies request played
- `publishShowChange(prevId, newId, name)`: Announces show transition
- `formatSegmentForBroadcast(segment)`: Formats for transmission
- `createSSEMessage(event, data)`: Creates SSE message format
- `getBroadcastStats()`: Returns listener counts

**Event Types:**
- `NOW_PLAYING`: Current segment metadata
- `QUEUE_UPDATE`: Upcoming segments (next 5)
- `REQUEST_PLAYED`: Request completion notification
- `SHOW_CHANGE`: Show transition announcement

**SSE Message Format:**
```
event: now_playing
data: {"segmentId":"seg_123","type":"music","showName":"Mild Panic Mornings",...}

```

**Integration Pattern:**
```typescript
// Subscribe to events
subscribeToBroadcast(BroadcastEvent.NOW_PLAYING, (data) => {
  // Send to WebSocket clients
  wss.clients.forEach(client => client.send(JSON.stringify(data)));
});
```

### 6. Main Scheduler (`scheduler.ts`)

**Responsibilities:**
- Orchestrates all modules
- Runs main scheduling loop
- Handles show transitions
- Manages content generation
- Publishes updates
- Performs cleanup

**Main Loop:**
```
Every check_interval seconds:
1. Get current show
2. Check for show transition
   - If near boundary, generate handover
3. Check queue depth
   - If low, generate content
4. Publish real-time updates
   - Now playing
   - Queue status
5. Perform cleanup (hourly)
   - Remove old segments
```

**Content Generation Logic:**
```
1. Calculate minutes needed
2. Get top-voted requests
3. For each request (until queue filled):
   a. Generate music track
   b. Generate commentary
   c. Create segment records
   d. Update next available slot
   e. Mark request as used
   f. Publish notifications
4. If still need content, generate idents
5. Log completion
```

**Error Recovery:**
- All operations wrapped in try-catch
- Errors logged but don't crash service
- Fallback content used on AI failures
- Service continues even with partial failures

## Configuration

**Environment Variables:**
```bash
# Database
DATABASE_URL="postgresql://..."

# Buffer settings
SCHEDULER_BUFFER_MINUTES=45        # Look-ahead window
MIN_QUEUE_DEPTH_MINUTES=15         # Replenishment trigger

# Timing
SCHEDULER_CHECK_INTERVAL=60        # Check frequency (seconds)

# Storage
AUDIO_STORAGE_PATH=/tmp/lofield/audio
ARCHIVE_PATH=/tmp/lofield/archive

# AI (optional, for future integration)
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...
REPLICATE_API_TOKEN=...
```

**Show Configuration (JSON):**
```json
{
  "schedule": {
    "days": ["mon", "tue", "wed", "thu", "fri"],
    "start_time_utc": "06:00",
    "end_time_utc": "09:00",
    "duration_hours": 3
  },
  "ratios": {
    "music_fraction": 0.5,
    "talk_fraction": 0.5
  },
  "presenters": {
    "primary_duo": ["morgan", "riley"]
  }
}
```

## Database Schema

**Key Tables:**
- `Show`: Show definitions and configuration
- `Segment`: Individual audio segments in queue
- `Track`: Generated music tracks
- `Request`: User requests with votes
- `Playlog`: Broadcast history

**Relationships:**
- Show → Segments (one-to-many)
- Request → Tracks (one-to-many)
- Request → Segments (one-to-many)
- Track → Segments (one-to-many)
- Segment → Playlog (one-to-many)

## Performance Considerations

**Database Queries:**
- Indexed on `startTime`, `endTime` for fast queue lookups
- Indexed on `showId` for show filtering
- Segments auto-deleted after broadcast (cleanup)

**Memory Usage:**
- Archive index stored in memory (consider DB for production)
- EventEmitter has bounded listener count
- Old segments pruned regularly

**Concurrency:**
- Single-threaded event loop
- Async/await for I/O operations
- No race conditions (sequential processing)

**Scalability:**
- Can run as single service (current)
- Could be split into microservices:
  - Content generator service
  - Archive service
  - Broadcast service

## Monitoring and Logging

**Logs:**
- Show transitions
- Queue status checks
- Content generation attempts
- AI failures and fallbacks
- Segment creation
- Broadcast events

**Metrics:**
- Queue depth (minutes)
- Segments by type
- Generation success rate
- Archive size
- Active listeners (broadcast)

**Health Checks:**
- Is scheduler running?
- Current show valid?
- Queue depth adequate?
- Recent segment created?
- Database connection alive?

## Future Enhancements

**Playback Engine:**
- FFmpeg/GStreamer integration
- Real audio mixing
- Crossfading between segments
- Volume normalization

**Advanced Features:**
- Dynamic music/talk ratios per show
- Request prioritization algorithms
- A/B testing for content
- Analytics and insights

**Optimization:**
- Parallel AI generation
- Caching of common segments
- Pre-generation during low activity
- Distributed processing

## Troubleshooting

**Queue running dry:**
- Check AI service status
- Verify request queue has content
- Check fallback content availability
- Increase buffer or check interval

**Show transitions not working:**
- Verify show schedules don't overlap
- Check handover generation
- Ensure 24-hour coverage

**Archiving issues:**
- Check disk space
- Verify archive path writable
- Check index consistency

**Performance problems:**
- Reduce check interval
- Increase buffer size
- Profile database queries
- Consider caching

---

*The scheduler: Keeping Lofield FM on the air, one segment at a time.*
