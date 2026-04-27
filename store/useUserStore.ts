import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type UserProfile } from "@/api/users";
import {
  getWalletUnlockedChapters,
  postWalletUnlock,
} from "@/api/wallet";

interface UserState {
  profile: UserProfile | null;
  /** Chapter IDs unlocked server-side (`GET /wallet/unlocked-chapters`), cached locally. */
  unlockedChapters: string[];
  isLoading: boolean;
  setProfile: (profile: UserProfile | null) => void;
  setUnlockedChapters: (ids: string[]) => void;
  /** Refresh unlock list from `GET /wallet/unlocked-chapters` (call after login). */
  fetchUnlockedChapters: () => Promise<void>;
  addCoins: (amount: number) => void;
  deductCoins: (amount: number) => boolean;
  /** Unlock via `POST /wallet/unlock`; updates balance from API when provided. */
  unlockChapter: (
    chapterId: string,
    cost: number,
  ) => Promise<{ success: boolean; error?: string }>;
  isChapterUnlocked: (chapterId: string) => boolean;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      profile: null,
      unlockedChapters: [],
      isLoading: false,
      setProfile: (profile) => set({ profile }),
      setUnlockedChapters: (ids) => set({ unlockedChapters: ids }),
      fetchUnlockedChapters: async () => {
        try {
          const ids = await getWalletUnlockedChapters();
          set({ unlockedChapters: ids });
        } catch {
          /* unauthenticated or network — keep cached unlocks */
        }
      },
      addCoins: (amount) =>
        set((state) => ({
          profile: state.profile
            ? {
                ...state.profile,
                coinBalance: state.profile.coinBalance + amount,
              }
            : null,
        })),
      deductCoins: (amount) => {
        const { profile } = get();
        if (!profile || profile.coinBalance < amount) return false;
        set({
          profile: { ...profile, coinBalance: profile.coinBalance - amount },
        });
        return true;
      },
      unlockChapter: async (chapterId, cost) => {
        const { profile, unlockedChapters } = get();
        if (unlockedChapters.includes(chapterId)) {
          return { success: true };
        }

        if (!profile || profile.coinBalance < cost) {
          return { success: false, error: "Insufficient coins" };
        }

        try {
          const res = await postWalletUnlock({ chapterId });
          const nextBalance =
            typeof res.coinBalance === "number"
              ? res.coinBalance
              : profile.coinBalance - cost;
          set({
            profile: { ...profile, coinBalance: nextBalance },
            unlockedChapters: [...unlockedChapters, chapterId],
          });
          void get().fetchUnlockedChapters();
          return { success: true };
        } catch (e) {
          return {
            success: false,
            error: e instanceof Error ? e.message : "Unlock failed",
          };
        }
      },
      isChapterUnlocked: (chapterId) => {
        return get().unlockedChapters.includes(chapterId);
      },
      logout: () => set({ profile: null, unlockedChapters: [] }),
    }),
    {
      name: "user-storage",
      version: 2,
      migrate: (persisted: unknown, _version: number) => {
        if (!persisted || typeof persisted !== "object") return persisted as UserState;
        const state = persisted as {
          profile?: { coinBalance?: number; coins?: number };
          unlockedChapters?: string[];
          isLoading?: boolean;
        };
        const p = state.profile;
        if (
          p &&
          typeof p.coinBalance !== "number" &&
          typeof p.coins === "number"
        ) {
          const { coins: legacy, ...rest } = p;
          return {
            ...state,
            profile: { ...rest, coinBalance: legacy },
          } as UserState;
        }
        return persisted as UserState;
      },
    }
  )
);
