"use server";

import "server-only";

import {
  adjustVoteCount,
  createElection,
  createRunoffBallot,
  finalizeBallot,
  finalizeElection as finalizeElectionRecord,
  getElectionState,
  updateCandidateOutcomes
} from "@scrutinium/db";
import {
  buildElectionSnapshot,
  rankBallot
} from "@/lib/election-logic";
import type { ElectionSnapshot } from "@/lib/types/election";
import {
  createElectionPayloadSchema,
  electionIdSchema,
  finalizeCountingSchema,
  type CreateElectionPayload,
  voteAdjustmentSchema
} from "@/lib/validation/election";

async function fetchElectionSnapshot(
  electionId: string
): Promise<ElectionSnapshot> {
  const state = await getElectionState(electionId);

  if (!state) {
    throw new Error("Election not found");
  }

  return buildElectionSnapshot(state);
}

export async function loadElectionAction(payload: { electionId: string }) {
  const { electionId } = electionIdSchema.parse(payload);
  return fetchElectionSnapshot(electionId);
}

export async function createElectionAction(payload: CreateElectionPayload) {
  const data = createElectionPayloadSchema.parse(payload);
  const candidates = data.candidates
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .map((name) => ({ name }));

  if (!candidates.length) {
    throw new Error("Please provide at least one candidate");
  }

  const { electionId } = await createElection({
    description: data.description.trim(),
    position: data.position.trim(),
    term: data.term.trim(),
    seats: data.seats,
    electionDate: new Date().toISOString(),
    candidates
  });

  return fetchElectionSnapshot(electionId);
}

export async function adjustVoteAction(payload: {
  ballotId: string;
  candidateId: string;
  delta: 1 | -1;
}) {
  const data = voteAdjustmentSchema.parse(payload);
  const votes = await adjustVoteCount(data);

  return {
    ballotId: data.ballotId,
    candidateId: data.candidateId,
    votes
  };
}

export async function finalizeCountingAction(payload: {
  electionId: string;
  ballotId: string;
}) {
  const data = finalizeCountingSchema.parse(payload);
  const state = await getElectionState(data.electionId);

  if (!state) {
    throw new Error("Election not found");
  }

  const ballot = state.ballots.find((entry) => entry.id === data.ballotId);

  if (!ballot) {
    throw new Error("Ballot not found");
  }

  if (ballot.status !== "counting") {
    throw new Error("This ballot has already been finalized");
  }

  const result = rankBallot(ballot);

  const winnerSet = new Set(result.winnerIds);
  const tieSet = new Set(result.tieCandidateIds);

  const outcomes = [
    ...Array.from(winnerSet).map((candidateId) => ({
      candidateId,
      electedBallotNumber: ballot.ballotNumber
    })),
    ...ballot.votes
      .map((vote) => vote.candidateId)
      .filter(
        (candidateId) => !winnerSet.has(candidateId) && !tieSet.has(candidateId)
      )
      .map((candidateId) => ({
        candidateId,
        eliminatedBallotNumber: ballot.ballotNumber
      }))
  ];

  if (outcomes.length) {
    await updateCandidateOutcomes(outcomes);
  }

  await finalizeBallot(ballot.id, {
    notes: tieSet.size
      ? `Tie detected for ${result.remainingSeats} seat(s)`
      : undefined
  });

  const snapshot = await fetchElectionSnapshot(data.electionId);
  return { snapshot, result };
}

export async function startRunoffAction(payload: { electionId: string }) {
  const { electionId } = electionIdSchema.parse(payload);
  const snapshot = await fetchElectionSnapshot(electionId);

  if (snapshot.currentBallot) {
    throw new Error("Finalize the current ballot before starting a new count.");
  }

  const latestBallot = snapshot.latestCompletedBallot;

  if (!latestBallot) {
    throw new Error("Finalize a count before starting a new one");
  }

  const result = rankBallot(latestBallot);

  if (!result.tieCandidateIds.length) {
    throw new Error("There is no tie to resolve");
  }

  await createRunoffBallot({
    electionId,
    candidateIds: result.tieCandidateIds,
    seatsAvailable: result.remainingSeats || 1,
    type: "runoff",
    notes: `Runoff after ballot ${latestBallot.ballotNumber}`
  });

  return fetchElectionSnapshot(electionId);
}

export async function finalizeElectionAction(payload: { electionId: string }) {
  const { electionId } = electionIdSchema.parse(payload);
  const snapshot = await fetchElectionSnapshot(electionId);

  if (snapshot.election.status === "finalized") {
    return snapshot;
  }

  if (snapshot.currentBallot) {
    throw new Error("Finish counting the active ballot before finalizing.");
  }

  if (snapshot.latestResult?.tieCandidateIds.length) {
    throw new Error("Resolve every tie before finalizing the election.");
  }

  const winners = snapshot.candidates.filter(
    (candidate) => candidate.electedBallotNumber !== null
  );

  if (winners.length < snapshot.election.seats) {
    throw new Error("All seats must be filled before finalizing the election.");
  }

  await finalizeElectionRecord(electionId);
  return fetchElectionSnapshot(electionId);
}

