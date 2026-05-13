import { z } from "zod";

/** Browser PushSubscription JSON (serialized). */
export const webPushSubscriptionJsonSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export type WebPushSubscriptionJson = z.infer<typeof webPushSubscriptionJsonSchema>;
