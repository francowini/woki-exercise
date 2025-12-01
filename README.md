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

### Running Tests

1. Install Bruno (https://www.usebruno.com/downloads)
2. Open the `bruno/` folder as a collection
3. Select "local" environment
4. Run requests individually or use Runner

### Test Files

| File | Scenario |
|------|----------|
| `discover-slots.bru` | Happy path - find available slots |
| `discover-no-capacity.bru` | Party too large |
| `discover-outside-window.bru` | Request outside service hours |
| `create-booking.bru` | Create valid booking |
| `create-booking-no-capacity.bru` | No capacity returns 409 |
| `get-bookings-day.bru` | List day's bookings |
| `delete-booking.bru` | Cancel booking |

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
