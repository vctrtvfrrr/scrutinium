# Scrutinium

Scrutinium is a Bun-powered Turborepo that orchestrates multi-round elections with live vote counting, tie-aware results, and a clear wrap-up experience. The stack includes Next.js (App Router), Tailwind + shadcn/ui, Drizzle ORM, SQLite, and Vitest for targeted logic tests.

## Features

- Guided four-step workflow: setup → counting → results → end.
- Real-time vote adjustments with optimistic UI feedback.
- Automatic detection of ties and run-off creation for remaining seats.
- Persistent storage via Drizzle ORM on SQLite with reusable server actions.
- Final summary that lists elected candidates and the ballot number where they secured their seat.

## Getting Started

```bash
bun install
# start everything (apps inherit Turborepo filtering)
bun run dev
```

Run the web app alone:

```bash
# from repo root
bun run dev --filter web
```

The UI is served at `http://localhost:3000`.

## Database scripts

Scrutinium stores data in `sqlite/elections.sqlite`. Useful commands:

```bash
# Generate SQL migrations from the Drizzle schema
bun run db:generate

# Apply migrations against the local SQLite file
bun run db:migrate
```

The generated SQL files live under the `drizzle/` directory and are committed to version control.

## Testing

Pure logic (tie handling and ranking) is covered with Vitest:

```bash
cd apps/web
bun run test
```

To run the Turborepo test pipeline (all packages that expose a `test` script):

```bash
bun run test
```

## Project structure

- `apps/web`: Next.js app router front-end + client/server actions.
- `packages/db`: Drizzle ORM schema, migrations, and data helpers.
- `packages/ui`: Shared utility exports (e.g., `cn`) and Tailwind preset.
- `drizzle/`: SQL migrations + snapshots.

## Workflow overview

1. **Form step** – capture election metadata and candidate roster (current date recorded automatically).
2. **Counting** – adjust votes with +/- buttons, keeping candidates ordered by their initial order.
3. **Results** – show ranked outcomes, highlight secured seats, and flag tie groups that need another ballot.
4. **End** – once all seats are filled without ties, finalize to display winners along with the ballot that elected them.

Every action persists to SQLite via Drizzle server actions, ensuring the UI remains consistent even after reloads.
