# Frontend Pages and Components

This document describes the frontend pages and components for browsing schedules, shows, archives, and requests.

## Pages

### `/schedule`

**Location:** `app/schedule/page.tsx`

Displays the 24-hour weekly programming schedule for Lofield FM. Shows all 8 shows across the week in a grid layout.

**Features:**
- Weekly grid view with shows organized by day (Monday-Sunday)
- Each show card displays:
  - Air time (UTC)
  - Show name
  - Music/talk ratio percentages
  - Brief description
- Clicking a show card navigates to the show detail page
- Fully responsive (adapts from mobile to desktop)

**Data Source:** Loads shows from `config/shows/*.json` via `lib/shows.ts`

**Metadata:**
- Title: "Schedule - Lofield FM"
- Description: "Browse the daily and weekly schedule for Lofield FM..."

---

### `/shows/[id]`

**Location:** `app/shows/[id]/page.tsx`

Dynamic route that displays detailed information about a specific show.

**Features:**
- Show description and schedule information
- Presenter profiles with personas and quirks
- Tone, mood, and energy level details
- Primary topics and themes
- Request acceptance status
- Music/talk ratio breakdown
- Back navigation to schedule page

**Data Source:** 
- Show data from `config/shows/*.json`
- Presenter data from `config/presenters.json`

**Static Generation:** Uses `generateStaticParams()` to pre-render all show pages at build time

**Metadata:** Dynamic metadata based on show name and description

---

### `/archive`

**Location:** `app/archive/page.tsx`

Browse and filter past show episodes with playback links.

**Features:**
- Filter by show (dropdown)
- Filter by date range (start/end date)
- Displays episode list with:
  - Show name
  - Date and time
  - Segment type
  - Play button (if stream URL available)
- Clear filters button
- Loading and error states
- Empty state when no episodes match filters

**Data Source:** Fetches from `/api/archive` endpoint using SWR

**API Parameters:**
- `show_id`: Filter by specific show
- `start_time`: Start date filter (ISO 8601)
- `end_time`: End date filter (ISO 8601)
- `limit`: Number of results (default 20, max 100)

**Metadata:**
- Title: "Archive - Lofield FM"
- Description: "Browse and listen to past shows and episodes..."

---

### `/requests`

**Location:** `app/requests/page.tsx`

Dedicated page for submitting and browsing listener requests.

**Features:**
- Request submission form
  - Type selection (music or talk)
  - Text input (10-500 characters)
  - Validation and error messages
- Live request feed
  - Pending requests with vote counts
  - Upvote functionality
  - Auto-refresh on submission
- Responsive two-column layout (stacks on mobile)

**Data Source:** 
- `/api/requests` endpoint for GET and POST
- `/api/requests/[id]/vote` for voting

**Metadata:**
- Title: "Requests - Lofield FM"
- Description: "Request a song or topic and see what others are requesting..."

---

## Components

### Schedule Components

#### `ScheduleGrid`

**Location:** `components/schedule/ScheduleGrid.tsx`

Client component that renders the weekly schedule grid.

**Props:**
- `schedule: ScheduleSlot[][]` - 2D array of schedule slots (7 days × N shows per day)

**Features:**
- Responsive grid (7 columns on large screens, 3 on medium, 2 on small)
- Day headers (Monday-Sunday)
- Uses `ShowCard` for each show

---

#### `ShowCard`

**Location:** `components/schedule/ShowCard.tsx`

Client component that renders an individual show card.

**Props:**
- `slot: ScheduleSlot` - Contains show, startTime, endTime, dayOfWeek

**Features:**
- Clickable card that links to show detail page
- Displays time range
- Show name
- Music/talk percentage badges
- Truncated description (2 lines max)
- Hover effects

---

### Show Components

#### `ShowDetailContent`

**Location:** `components/shows/ShowDetailContent.tsx`

Client component that renders detailed show information.

**Props:**
- `show: Show` - Full show data
- `presenters: Presenter[]` - Associated presenters

**Features:**
- Organized into sections:
  - Show Schedule
  - Presenters
  - Tone & Mood
  - Topics & Themes
- Tag rendering for topics
- Conditional rendering for optional fields
- Responsive layout

---

### Archive Components

#### `ArchiveBrowser`

**Location:** `components/archive/ArchiveBrowser.tsx`

Client component for browsing and filtering archived episodes.

**Props:**
- `shows: Show[]` - List of all shows for filter dropdown

**Features:**
- Filter controls (show, start date, end date)
- SWR for data fetching with automatic revalidation
- Loading, error, and empty states
- Episode list with play buttons
- Formatted dates and times

**State Management:**
- Uses React useState for filter values
- Query parameters automatically update via SWR key
- Clear filters resets all state

---

### Request Components

#### `RequestsContent`

**Location:** `components/requests/RequestsContent.tsx`

Client wrapper component for the requests page content.

**Features:**
- Two-column layout with form and feed
- Responsive design

---

#### `RequestFeedPage`

**Location:** `components/requests/RequestFeedPage.tsx`

Client component wrapper for the request feed.

**Features:**
- Scrollable container (max-height 600px)
- Uses existing `RequestFeed` component

---

## Utilities

### `lib/shows.ts`

Core utility module for loading and processing show data.

**Functions:**

- `loadShows(): Show[]` - Loads all shows from config files, sorted by start time. Cached for performance.
  
- `getShowById(id: string): Show | null` - Retrieves a specific show by ID.

- `getPresentersForShow(show: Show): Presenter[]` - Gets presenters for a show.

- `generateWeeklySchedule(): ScheduleSlot[][]` - Generates 7-day schedule grid.

- `getCurrentShow(now?: Date): Show | null` - Determines which show is currently playing based on UTC time.

- `clearShowsCache(): void` - Clears the cache (useful for testing).

**Caching:** Shows are loaded once and cached to avoid repeated file reads.

**File System:** Uses Node.js `fs` module to read JSON config files. Only works in server components or API routes.

---

## Data Flow

### Schedule Page Flow
1. Server component loads shows via `loadShows()` from file system
2. Generates weekly schedule via `generateWeeklySchedule()`
3. Passes schedule data to client `ScheduleGrid` component
4. User clicks show card → navigates to `/shows/[id]`

### Show Detail Flow
1. Next.js pre-renders all show pages at build time using `generateStaticParams()`
2. Server component loads show and presenter data from config files
3. Passes data to client `ShowDetailContent` component
4. User can navigate back to schedule

### Archive Flow
1. Server component loads shows list from config
2. Passes to client `ArchiveBrowser` component
3. Component fetches episodes from `/api/archive` via SWR
4. User adjusts filters → SWR re-fetches with new parameters
5. User clicks play → opens stream URL

### Requests Flow
1. Server renders page wrapper with metadata
2. Client `RequestsContent` component renders
3. `RequestForm` submits to `/api/requests` POST endpoint
4. `RequestFeedPage` displays pending requests from `/api/requests` GET
5. User votes → POST to `/api/requests/[id]/vote`

---

## Navigation

The main navigation is in `app/layout.tsx`:
- Home (`/`)
- Schedule (`/schedule`)
- Archive (`/archive`)
- Requests (`/requests`)

All navigation links are in the header and accessible on every page.

---

## Styling

All components use:
- Tailwind CSS for styling
- Design tokens from `globals.css`
- Responsive utility classes
- Existing card patterns (border, bg-card, shadow-sm)
- Color scheme support (light/dark mode)

---

## Testing

Tests are located in `lib/__tests__/shows.test.ts`

**Coverage:**
- Show loading and caching
- Show retrieval by ID
- Presenter filtering
- Weekly schedule generation
- Current show detection

**Test Strategy:**
- Mock file system (`fs` module)
- Test data fixtures
- Cache clearing between tests
- Edge cases (missing shows, wrong times, etc.)

To run tests:
```bash
npm test -- shows.test.ts
```

---

## Adding New Features

### Adding a New Show
1. Create JSON file in `config/shows/`
2. Follow existing schema (see `config/shows/morning_commute.json`)
3. Show will automatically appear in schedule on next build
4. Static page will be pre-rendered at `/shows/[id]`

### Adding a New Page
1. Create page in `app/[route]/page.tsx`
2. Add metadata export for SEO
3. Update navigation in `app/layout.tsx`
4. Use existing components and patterns
5. Test responsive behavior

### Modifying Show Display
1. Update `ShowCard` or `ShowDetailContent` components
2. Ensure responsive design is maintained
3. Test with different show configurations
4. Verify Tailwind classes compile correctly

---

## Performance Considerations

- **Static Generation:** Show detail pages are pre-rendered at build time
- **Caching:** Show data is cached in memory after first load
- **SWR:** Archive and request data use SWR for efficient fetching and caching
- **Server Components:** Default to server components where possible
- **Code Splitting:** Next.js automatically splits client components

---

## Future Enhancements

Potential improvements not yet implemented:

- Pagination for archive results
- Search functionality for episodes
- Audio player integration for archive playback
- Request filtering (by type, status, date)
- Show subscription/favorites
- Calendar view for schedule
- Time zone conversion
- Accessibility improvements (ARIA labels, keyboard navigation)
- Unit tests for React components

---

## Resources

- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [SWR Documentation](https://swr.vercel.app/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- Configuration Schema: `schemas/` directory
- Style Guide: `docs/style_guide.md`
