import { z } from "zod";

export const clientTrainerReviewUpsertSchema = z.object({
  stars: z.number().int().min(1).max(5),
  testimonial: z.string().max(1_400).optional().nullable(),
});

export type ClientTrainerReviewUpsertInput = z.infer<typeof clientTrainerReviewUpsertSchema>;
