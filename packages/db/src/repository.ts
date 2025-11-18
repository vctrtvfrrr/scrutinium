import { createId } from "@paralleldrive/cuid2";
import { and, eq, inArray, max } from "drizzle-orm";
import { db } from "./client";
import {
  ballots,
  ballotVotes,
  candidates,
  elections
} from "./schema";
import {
  candidateOutcomeSchema,
  type CandidateOutcomeInput,
  newElectionSchema,
  type NewElectionInput,
  runoffBallotSchema,
  type RunoffBallotInput,
  voteAdjustmentSchema,
  type VoteAdjustmentInput,
  voteUpdateSchema,
  type VoteUpdateInput
} from "./types";

const now = () => new Date();

export async function createElection(input: NewElectionInput) {
  const payload = newElectionSchema.parse(input);

  return db.transaction(async (tx) => {
    const electionId = createId();
    const electionRow = {
      id: electionId,
      description: payload.description.trim(),
      position: payload.position.trim(),
      term: payload.term.trim(),
      seats: payload.seats,
      electionDate: payload.electionDate,
      status: "counting" as const,
      currentBallotNumber: 1
    };

    await tx.insert(elections).values(electionRow);

    const candidateRows = payload.candidates.map((candidate, index) => ({
      id: createId(),
      electionId,
      name: candidate.name.trim(),
      sortOrder: index
    }));

    if (candidateRows.length) {
      await tx.insert(candidates).values(candidateRows);
    }

    const ballotId = createId();
    await tx.insert(ballots).values({
      id: ballotId,
      electionId,
      ballotNumber: 1,
      seatsAvailable: payload.seats,
      type: "primary",
      status: "counting"
    });

    if (candidateRows.length) {
      await tx.insert(ballotVotes).values(
        candidateRows.map((candidate) => ({
          id: createId(),
          ballotId,
          candidateId: candidate.id,
          votes: 0
        }))
      );
    }

    return {
      electionId,
      ballotId,
      candidateIds: candidateRows.map((candidate) => candidate.id)
    };
  });
}

export async function getElectionState(electionId: string) {
  const record = await db.query.elections.findFirst({
    where: eq(elections.id, electionId),
    with: {
      candidates: {
        orderBy: (candidate, { asc }) => [asc(candidate.sortOrder)]
      },
      ballots: {
        orderBy: (ballot, { asc }) => [asc(ballot.ballotNumber)],
        with: {
          votes: {
            with: {
              candidate: true
            },
            orderBy: (vote, { asc }) => [asc(vote.candidateId)]
          }
        }
      }
    }
  });

  if (!record) {
    return null;
  }

  for (const ballot of record.ballots) {
    ballot.votes.sort((left, right) => {
      const leftOrder = left.candidate.sortOrder;
      const rightOrder = right.candidate.sortOrder;
      return leftOrder - rightOrder;
    });
  }

  return record;
}

export async function getBallot(ballotId: string) {
  const ballot = await db.query.ballots.findFirst({
    where: eq(ballots.id, ballotId),
    with: {
      votes: {
        with: {
          candidate: true
        },
        orderBy: (vote, { asc }) => [asc(vote.candidateId)]
      }
    }
  });

  return ballot ?? null;
}

export async function setVoteCounts(updates: VoteUpdateInput[]) {
  if (!updates.length) {
    return;
  }

  const parsed = updates.map((item) => voteUpdateSchema.parse(item));

  await db.transaction(async (tx) => {
    for (const update of parsed) {
      await tx
        .update(ballotVotes)
        .set({ votes: update.votes, updatedAt: now() })
        .where(
          and(
            eq(ballotVotes.ballotId, update.ballotId),
            eq(ballotVotes.candidateId, update.candidateId)
          )
        );
    }
  });
}

export async function adjustVoteCount(input: VoteAdjustmentInput) {
  const payload = voteAdjustmentSchema.parse(input);

  return db.transaction(async (tx) => {
    const existing = await tx.query.ballotVotes.findFirst({
      where: (record, { and, eq }) =>
        and(
          eq(record.ballotId, payload.ballotId),
          eq(record.candidateId, payload.candidateId)
        )
    });

    if (!existing) {
      throw new Error("Candidate vote record not found");
    }

    const currentVotes = existing.votes;
    const nextVotes = Math.max(0, currentVotes + payload.delta);

    await tx
      .update(ballotVotes)
      .set({ votes: nextVotes, updatedAt: now() })
      .where(
        and(
          eq(ballotVotes.ballotId, payload.ballotId),
          eq(ballotVotes.candidateId, payload.candidateId)
        )
      );

    return nextVotes;
  });
}

export async function createRunoffBallot(input: RunoffBallotInput) {
  const payload = runoffBallotSchema.parse(input);
  const uniqueCandidates = Array.from(new Set(payload.candidateIds));

  return db.transaction(async (tx) => {
    const [maxResult] = await tx
      .select({ value: max(ballots.ballotNumber) })
      .from(ballots)
      .where(eq(ballots.electionId, payload.electionId));

    const ballotNumber = (maxResult.value ?? 0) + 1;
    const ballotId = createId();

    const existingCandidates = await tx
      .select({ id: candidates.id })
      .from(candidates)
      .where(
        and(
          eq(candidates.electionId, payload.electionId),
          inArray(candidates.id, uniqueCandidates)
        )
      );

    if (existingCandidates.length !== uniqueCandidates.length) {
      throw new Error("Invalid candidates for runoff ballot");
    }

    await tx.insert(ballots).values({
      id: ballotId,
      electionId: payload.electionId,
      ballotNumber,
      seatsAvailable: payload.seatsAvailable,
      type: payload.type,
      status: "counting",
      notes: payload.notes
    });

    await tx.insert(ballotVotes).values(
      uniqueCandidates.map((candidateId) => ({
        id: createId(),
        ballotId,
        candidateId,
        votes: 0
      }))
    );

    await tx
      .update(elections)
      .set({ currentBallotNumber: ballotNumber })
      .where(eq(elections.id, payload.electionId));

    return { ballotId, ballotNumber };
  });
}

export async function finalizeBallot(
  ballotId: string,
  options?: { notes?: string }
) {
  await db
    .update(ballots)
    .set({
      status: "completed",
      finalizedAt: now(),
      notes: options?.notes
    })
    .where(eq(ballots.id, ballotId));
}

export async function updateCandidateOutcomes(
  outcomes: CandidateOutcomeInput[]
) {
  if (!outcomes.length) {
    return;
  }

  await db.transaction(async (tx) => {
    for (const outcome of outcomes.map((item) =>
      candidateOutcomeSchema.parse(item)
    )) {
      const payload: {
        electedBallotNumber?: number | null;
        eliminatedBallotNumber?: number | null;
      } = {};

      if (Object.prototype.hasOwnProperty.call(outcome, "electedBallotNumber")) {
        payload.electedBallotNumber = outcome.electedBallotNumber ?? null;
      }

      if (
        Object.prototype.hasOwnProperty.call(outcome, "eliminatedBallotNumber")
      ) {
        payload.eliminatedBallotNumber = outcome.eliminatedBallotNumber ?? null;
      }

      if (Object.keys(payload).length === 0) {
        continue;
      }

      await tx
        .update(candidates)
        .set(payload)
        .where(eq(candidates.id, outcome.candidateId));
    }
  });
}

export async function finalizeElection(electionId: string) {
  await db
    .update(elections)
    .set({
      status: "finalized",
      finalizedAt: now()
    })
    .where(eq(elections.id, electionId));
}

