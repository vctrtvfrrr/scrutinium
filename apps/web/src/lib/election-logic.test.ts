import { describe, expect, it } from "vitest";
import { rankBallot } from "./election-logic";
import type { BallotWithVotes } from "./types/election";

const buildCandidate = (id: string, name: string, sortOrder: number) => ({
  id,
  electionId: "election-1",
  name,
  sortOrder,
  createdAt: Date.now(),
  electedBallotNumber: null,
  eliminatedBallotNumber: null
});

const buildVote = (
  ballotId: string,
  candidate: ReturnType<typeof buildCandidate>,
  votes: number
) => ({
  id: `${ballotId}-${candidate.id}`,
  ballotId,
  candidateId: candidate.id,
  votes,
  updatedAt: Date.now(),
  candidate
});

const buildBallot = (overrides?: Partial<BallotWithVotes>): BallotWithVotes => ({
  id: "ballot-1",
  electionId: "election-1",
  ballotNumber: 1,
  seatsAvailable: 2,
  type: "primary",
  status: "completed",
  notes: null,
  startedAt: Date.now(),
  finalizedAt: Date.now(),
  votes: [],
  ...overrides
});

describe("rankBallot", () => {
  it("marks top candidates as winners when there are enough seats", () => {
    const alice = buildCandidate("alice", "Alice", 0);
    const bob = buildCandidate("bob", "Bob", 1);
    const claire = buildCandidate("claire", "Claire", 2);

    const ballot = buildBallot({
      votes: [
        buildVote("ballot-1", alice, 10),
        buildVote("ballot-1", bob, 7),
        buildVote("ballot-1", claire, 5)
      ]
    });

    const result = rankBallot(ballot);

    expect(result.winnerIds).toEqual(["alice", "bob"]);
    expect(result.tieCandidateIds).toEqual([]);
    expect(result.ranked.map((entry) => entry.rank)).toEqual([1, 2, 3]);
  });

  it("captures ties when seats run out", () => {
    const alice = buildCandidate("alice", "Alice", 0);
    const bob = buildCandidate("bob", "Bob", 1);

    const ballot = buildBallot({
      seatsAvailable: 1,
      votes: [
        buildVote("ballot-1", alice, 15),
        buildVote("ballot-1", bob, 15)
      ]
    });

    const result = rankBallot(ballot);

    expect(result.winnerIds).toEqual([]);
    expect(result.tieCandidateIds).toEqual(["alice", "bob"]);
    expect(result.remainingSeats).toBe(1);
  });

  it("only highlights groups that have secured seats", () => {
    const alice = buildCandidate("alice", "Alice", 0);
    const bob = buildCandidate("bob", "Bob", 1);
    const claire = buildCandidate("claire", "Claire", 2);

    const ballot = buildBallot({
      seatsAvailable: 2,
      votes: [
        buildVote("ballot-1", alice, 12),
        buildVote("ballot-1", bob, 8),
        buildVote("ballot-1", claire, 8)
      ]
    });

    const result = rankBallot(ballot);

    expect(result.winnerIds).toEqual(["alice"]);
    expect(result.tieCandidateIds).toEqual(["bob", "claire"]);
    expect(result.remainingSeats).toBe(1);
  });
});

