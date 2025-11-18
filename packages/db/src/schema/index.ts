import { relations } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const electionStatuses = ["draft", "counting", "finalized"] as const;
export const ballotStatuses = ["counting", "completed"] as const;
export const ballotTypes = ["primary", "runoff"] as const;

export const elections = sqliteTable("elections", {
  id: text("id").primaryKey(),
  description: text("description").notNull(),
  position: text("position").notNull(),
  term: text("term").notNull(),
  seats: integer("seats").notNull(),
  electionDate: text("election_date").notNull(),
  status: text("status", { enum: electionStatuses }).notNull().default("draft"),
  currentBallotNumber: integer("current_ballot_number").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  finalizedAt: integer("finalized_at", { mode: "timestamp_ms" })
});

export const ballots = sqliteTable(
  "ballots",
  {
    id: text("id").primaryKey(),
    electionId: text("election_id")
      .notNull()
      .references(() => elections.id, { onDelete: "cascade" }),
    ballotNumber: integer("ballot_number").notNull(),
    seatsAvailable: integer("seats_available").notNull(),
    type: text("type", { enum: ballotTypes }).notNull().default("primary"),
    status: text("status", { enum: ballotStatuses })
      .notNull()
      .default("counting"),
    notes: text("notes"),
    startedAt: integer("started_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    finalizedAt: integer("finalized_at", { mode: "timestamp_ms" })
  },
  (table) => [
    index("ballots_election_idx").on(table.electionId),
    uniqueIndex("ballots_unique_round").on(
      table.electionId,
      table.ballotNumber
    )
  ]
);

export const candidates = sqliteTable(
  "candidates",
  {
    id: text("id").primaryKey(),
    electionId: text("election_id")
      .notNull()
      .references(() => elections.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    electedBallotNumber: integer("elected_ballot_number"),
    eliminatedBallotNumber: integer("eliminated_ballot_number")
  },
  (table) => [
    index("candidates_election_idx").on(table.electionId),
    index("candidates_order_idx").on(table.sortOrder)
  ]
);

export const ballotVotes = sqliteTable(
  "ballot_votes",
  {
    id: text("id").primaryKey(),
    ballotId: text("ballot_id")
      .notNull()
      .references(() => ballots.id, { onDelete: "cascade" }),
    candidateId: text("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    votes: integer("votes").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`)
  },
  (table) => [
    index("ballot_votes_ballot_idx").on(table.ballotId),
    index("ballot_votes_candidate_idx").on(table.candidateId),
    uniqueIndex("ballot_votes_unique_candidate").on(
      table.ballotId,
      table.candidateId
    )
  ]
);

export const electionsRelations = relations(elections, ({ many }) => ({
  ballots: many(ballots),
  candidates: many(candidates)
}));

export const ballotRelations = relations(ballots, ({ many, one }) => ({
  election: one(elections, {
    fields: [ballots.electionId],
    references: [elections.id]
  }),
  votes: many(ballotVotes)
}));

export const candidateRelations = relations(candidates, ({ many, one }) => ({
  election: one(elections, {
    fields: [candidates.electionId],
    references: [elections.id]
  }),
  votes: many(ballotVotes)
}));

export const ballotVoteRelations = relations(ballotVotes, ({ one }) => ({
  ballot: one(ballots, {
    fields: [ballotVotes.ballotId],
    references: [ballots.id]
  }),
  candidate: one(candidates, {
    fields: [ballotVotes.candidateId],
    references: [candidates.id]
  })
}));

