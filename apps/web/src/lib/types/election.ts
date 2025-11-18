import type { schema } from "@scrutinium/db";

export type ElectionRow = typeof schema.elections.$inferSelect;
export type CandidateRow = typeof schema.candidates.$inferSelect;
export type BallotRow = typeof schema.ballots.$inferSelect;
export type BallotVoteRow = typeof schema.ballotVotes.$inferSelect;

export type BallotWithVotes = BallotRow & {
  votes: (
    BallotVoteRow & {
      candidate: CandidateRow;
    }
  )[];
};

export interface RankedCandidate extends CandidateRow {
  votes: number;
  rank: number;
  isWinner: boolean;
  inTie: boolean;
}

export interface BallotResult {
  ballotId: string;
  ballotNumber: number;
  seatsAvailable: number;
  status: BallotRow["status"];
  type: BallotRow["type"];
  ranked: RankedCandidate[];
  winnerIds: string[];
  tieCandidateIds: string[];
  remainingSeats: number;
}

export interface ElectionSnapshot {
  election: ElectionRow;
  candidates: CandidateRow[];
  ballots: BallotWithVotes[];
  currentBallot?: BallotWithVotes;
  latestCompletedBallot?: BallotWithVotes;
  latestResult?: BallotResult;
}

