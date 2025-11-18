import type { getElectionState } from "@scrutinium/db";
import type {
  BallotResult,
  BallotWithVotes,
  CandidateRow,
  ElectionSnapshot
} from "./types/election";

export type DbElectionState = NonNullable<
  Awaited<ReturnType<typeof getElectionState>>
>;

export function rankBallot(ballot: BallotWithVotes): BallotResult {
  const enriched = [...ballot.votes]
    .map((vote) => ({
      ...vote.candidate,
      votes: vote.votes
    }))
    .sort((left, right) => {
      if (right.votes !== left.votes) {
        return right.votes - left.votes;
      }

      return left.name.localeCompare(right.name);
    });

  const winnerIds: string[] = [];
  const tieCandidateIds: string[] = [];
  let seatsRemaining = ballot.seatsAvailable;

  const groups: CandidateRow[][] = [];
  let index = 0;
  while (index < enriched.length) {
    const currentVotes = enriched[index].votes;
    const group: CandidateRow[] = [];

    while (index < enriched.length && enriched[index].votes === currentVotes) {
      group.push(enriched[index]);
      index += 1;
    }

    groups.push(group);
  }

  for (const group of groups) {
    if (seatsRemaining <= 0) {
      break;
    }

    if (group.length <= seatsRemaining) {
      winnerIds.push(...group.map((candidate) => candidate.id));
      seatsRemaining -= group.length;
    } else {
      tieCandidateIds.push(...group.map((candidate) => candidate.id));
      break;
    }
  }

  const winnerSet = new Set(winnerIds);
  const tieSet = new Set(tieCandidateIds);

  let currentRank = 0;
  let previousVotes: number | null = null;
  const ranked = enriched.map((candidate, position) => {
    if (previousVotes === null || candidate.votes !== previousVotes) {
      currentRank = position + 1;
      previousVotes = candidate.votes;
    }

    return {
      ...candidate,
      rank: currentRank,
      isWinner: winnerSet.has(candidate.id),
      inTie: tieSet.has(candidate.id)
    };
  });

  return {
    ballotId: ballot.id,
    ballotNumber: ballot.ballotNumber,
    seatsAvailable: ballot.seatsAvailable,
    status: ballot.status,
    type: ballot.type,
    ranked,
    winnerIds,
    tieCandidateIds,
    remainingSeats: tieCandidateIds.length ? Math.max(seatsRemaining, 1) : 0
  };
}

export function buildElectionSnapshot(
  state: DbElectionState
): ElectionSnapshot {
  const { ballots: ballotRecords, candidates, ...election } = state;
  const ballots = [...ballotRecords].sort(
    (left, right) => left.ballotNumber - right.ballotNumber
  );

  const currentBallot = ballots.find((ballot) => ballot.status === "counting");
  const completed = ballots
    .filter((ballot) => ballot.status === "completed")
    .sort((left, right) => right.ballotNumber - left.ballotNumber);
  const latestCompletedBallot = completed.at(0);

  return {
    election,
    candidates,
    ballots,
    currentBallot,
    latestCompletedBallot,
    latestResult: latestCompletedBallot
      ? rankBallot(latestCompletedBallot)
      : undefined
  };
}

