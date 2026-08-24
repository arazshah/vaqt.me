import { z } from 'zod';

export const getConversationSchema = z.object({
  id: z.string().min(1, 'شناسه‌ی گفتگو الزامی است'),
});
export type GetConversationInput = z.infer<typeof getConversationSchema>;

export const listMessagesSchema = z.object({
  conversationId: z.string().min(1, 'شناسه‌ی گفتگو الزامی است'),
  cursor: z.string().min(1).nullable().optional(),
  limit: z.number().int().min(1).max(50).optional().default(30),
});
export type ListMessagesInput = z.infer<typeof listMessagesSchema>;

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1, 'شناسه‌ی گفتگو الزامی است'),
  body: z
    .string()
    .trim()
    .min(1, 'متن پیام الزامی است')
    .max(4000, 'متن پیام حداکثر ۴۰۰۰ نویسه می‌تواند باشد'),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
