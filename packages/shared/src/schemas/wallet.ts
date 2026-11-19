import { z } from 'zod';

export const WALLET_SOURCES = ['saved', 'exchanged'] as const;
export type WalletSource = (typeof WALLET_SOURCES)[number];

export const walletTargetSchema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(30),
});
export type WalletTargetInput = z.infer<typeof walletTargetSchema>;

export interface WalletEntryView {
  username: string;
  displayName: string;
  headline: string | null;
  city: string | null;
  avatarUrl: string | null;
  source: WalletSource;
  savedAt: string;
}

export interface WalletStatusView {
  saved: boolean;
  exchanged: boolean;
}
