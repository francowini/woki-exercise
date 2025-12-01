# WokiBrain

Restaurant table booking engine with automatic seat selection and table combination support.

> **Versión en español:** [README.es.md](./README.es.md)

## Quick Start

```bash
npm install
npm run dev
```

Server runs on http://localhost:3000

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled app |
| `npm test` | Run tests |

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Fastify
- **Validation:** Zod
- **Logging:** Pino
- **Testing:** Vitest
- **Storage:** In-memory (resets on restart)

## API Endpoints

### `GET /woki/discover`

Find available slots without creating a booking.

```
GET /woki/discover?restaurantId=R1&sectorId=S1&date=2025-10-22&partySize=5&duration=90
```

Optional: `windowStart`, `windowEnd`, `limit`

### `POST /woki/bookings`

Create a booking. WokiBrain automatically selects the best table(s).

```json
{
  "restaurantId": "R1",
  "sectorId": "S1",
  "partySize": 5,
  "durationMinutes": 90,
  "date": "2025-10-22",
  "windowStart": "20:00",
  "windowEnd": "23:45"
}
```

Supports `Idempotency-Key` header (60s TTL).

### `GET /woki/bookings/day`

List bookings for a specific day.

```
GET /woki/bookings/day?restaurantId=R1&sectorId=S1&date=2025-10-22
```

### `DELETE /woki/bookings/:id`

Cancel a booking. Returns 204.

### `GET /metrics`

Operational metrics for monitoring (Bonus B8).

```json
{
  "bookings": {
    "created": 5,
    "cancelled": 1,
    "conflicts": 2
  },
  "locks": {
    "acquired": 7,
    "waits": 1,
    "contentionRate": 0.143
  },
  "timing": {
    "assignmentP95Ms": 45,
    "sampleCount": 5
  }
}
```

**Metrics:**
- `bookings.created/cancelled/conflicts` — Counter for each booking outcome
- `locks.contentionRate` — Ratio of requests that waited for a lock (higher = more contention)
- `timing.assignmentP95Ms` — 95th percentile booking creation time in ms

## Algorithm Design

### Combo Capacity Heuristic

For table combinations, capacity is calculated as simple sums:

```
comboMin = sum of all table minSize values
comboMax = sum of all table maxSize values
```

Example: Tables A (2-4) + B (4-6) = Combo capacity 6-10

This approach was chosen for simplicity and predictability. No merge penalties are applied since restaurant tables typically maintain their individual capacity when combined.

### WokiBrain Selection Strategy

The algorithm scores each candidate slot and picks the lowest score:

```
score = (waste × 100) + (tableCount × 10) + minutesFromWindowStart
```

**Factors (in priority order):**

1. **Waste minimization (×100):** Prefer tables closest to party size
2. **Single tables preferred (×10):** Slight penalty per table in combo
3. **Earlier slots (×1):** Tie-breaker favors earlier availability

**Tie-breaker:** Alphabetical by first table ID (ensures determinism)

**Why this strategy:**
- Minimizes unused seats (efficient for the restaurant)
- Prefers simpler setups (single tables over combos)
- Deterministic: same inputs always produce same output

### Gap Discovery

1. For each table, find gaps between existing bookings within service windows
2. For combos, intersect gap sets to find times when all tables are free
3. Generate slots aligned to 15-minute grid
4. Intervals are `[start, end)` — adjacent bookings don't conflict

### Concurrency Control

**Lock key format:** `{sectorId}|{table1}+{table2}+...|{startTime}`

Tables are sorted alphabetically. Lock is acquired before writing and released in `finally` block.

## Testing with Bruno

We use [Bruno](https://www.usebruno.com/) for API testing because:

- **Git-friendly:** Tests are plain text files, easy to diff and review
- **No cloud sync:** Everything stays local, no account needed
- **Readable format:** `.bru` files are human-readable

### How to Use

1. Install Bruno (https://www.usebruno.com/downloads)
2. Open the `bruno/` folder as a collection
3. Select "local" environment
4. Run requests individually

### Request Collection

| # | File | Endpoint | Description |
|---|------|----------|-------------|
| 1 | `health-check.bru` | GET / | Verify server is running |
| 2 | `discover-slots.bru` | GET /woki/discover | Find available slots |
| 3 | `discover-with-window.bru` | GET /woki/discover | Filter by time window |
| 4 | `discover-not-found.bru` | GET /woki/discover | 404 error case |
| 5 | `discover-no-capacity.bru` | GET /woki/discover | 409 error case |
| 6 | `discover-outside-window.bru` | GET /woki/discover | 422 error case |
| 7 | `create-booking.bru` | POST /woki/bookings | Create booking |
| 8 | `create-booking-no-capacity.bru` | POST /woki/bookings | 409 error case |
| 9 | `get-bookings-day.bru` | GET /woki/bookings/day | List day's bookings |
| 10 | `delete-booking.bru` | DELETE /woki/bookings/:id | Cancel booking |
| 11 | `delete-booking-not-found.bru` | DELETE /woki/bookings/:id | 404 error case |
| 12 | `get-metrics.bru` | GET /metrics | Get operational metrics |

## Error Codes

| Status | Code | When |
|--------|------|------|
| 400 | `invalid_input` | Bad format, non-grid times, missing fields |
| 404 | `not_found` | Restaurant/sector/booking not found |
| 409 | `no_capacity` | No single or combo fits requirements |
| 422 | `outside_service_window` | Requested window outside service hours |

## Design Decisions

### Why In-Memory Storage (No Database)

Following the exercise specification (§3, §9), we use in-memory storage instead of PostgreSQL/Docker:

- **Exercise requirement:** "Persistence: In-memory" is explicitly listed in the technical requirements
- **Simplicity:** No Docker setup, no database migrations, no connection strings
- **Zero dependencies:** `npm install && npm run dev` just works
- **Focus on algorithms:** The challenge evaluates gap discovery, combo intersection, and WokiBrain selection — not database operations

For production, the store interfaces (`db.ts`) could be swapped to a real database without changing business logic.

### Why Fastify over Express

- Native TypeScript support with schema-based validation
- Better performance out of the box
- Cleaner async/await patterns

### Why Bruno for API Testing

- **Git-trackable:** `.bru` files are plain text, easy to diff and review in PRs
- **No account required:** Unlike Postman, everything stays local
- **Readable format:** Human-readable syntax without JSON nesting

## Data

Seed data loads from `src/data/seed.json` on startup. Includes one restaurant with 5 tables (capacity range 2-6 per table).

## Exercise Reference

This project implements the WokiBrain booking engine challenge. See [exercise.md](./exercise.md) for the full specification including:

- Core requirements (§1-§6)
- Acceptance criteria (§6)
- Test cases (§7)
- Bonus features (§12)

**Implemented bonus:** B8 - Observability (`/metrics` endpoint)
