import { z } from "zod";

export const candidateListSchema = z
  .array(z.string().trim().min(1))
  .min(1)
  .max(50);

export const createElectionPayloadSchema = z.object({
  description: z.string().min(1).max(500),
  position: z.string().min(1).max(200),
  term: z.string().min(1).max(200),
  seats: z.number().int().min(1).max(50),
  candidates: candidateListSchema
});

export type CreateElectionPayload = z.infer<typeof createElectionPayloadSchema>;

export const voteAdjustmentSchema = z.object({
  ballotId: z.string().min(1),
  candidateId: z.string().min(1),
  delta: z.union([z.literal(1), z.literal(-1)])
});

export const finalizeCountingSchema = z.object({
  electionId: z.string().min(1),
  ballotId: z.string().min(1)
});

export const electionIdSchema = z.object({
  electionId: z.string().min(1)
});

