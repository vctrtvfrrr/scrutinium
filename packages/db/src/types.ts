import { z } from "zod";

export const candidateNameSchema = z.string().min(1).max(200).trim();

export const newElectionSchema = z.object({
  description: z.string().min(1).max(500),
  position: z.string().min(1).max(200),
  term: z.string().min(1).max(200),
  seats: z.number().int().min(1).max(50),
  electionDate: z.string().min(4),
  candidates: z
    .array(z.object({ name: candidateNameSchema }))
    .min(1)
    .max(50)
});

export type NewElectionInput = z.infer<typeof newElectionSchema>;

export const voteUpdateSchema = z.object({
  ballotId: z.string().min(1),
  candidateId: z.string().min(1),
  votes: z.number().int().min(0)
});

export type VoteUpdateInput = z.infer<typeof voteUpdateSchema>;

export const runoffBallotSchema = z.object({
  electionId: z.string().min(1),
  candidateIds: z.array(z.string().min(1)).min(1),
  seatsAvailable: z.number().int().min(1),
  type: z.enum(["primary", "runoff"]).default("runoff"),
  notes: z.string().optional()
});

export type RunoffBallotInput = z.infer<typeof runoffBallotSchema>;

export const candidateOutcomeSchema = z.object({
  candidateId: z.string().min(1),
  electedBallotNumber: z.number().int().min(1).optional().nullable(),
  eliminatedBallotNumber: z.number().int().min(1).optional().nullable()
});

export type CandidateOutcomeInput = z.infer<typeof candidateOutcomeSchema>;

