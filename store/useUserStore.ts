import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type UserProfile } from "@/api/users";

interface UserState {
  profile: UserProfile | null;
  unlockedChapters: string[]; // Array of chapter IDs
  isLoading: boolean;
  setProfile: (profile: UserProfile | null) => void;
  addCoins: (amount: number) => void;
  deductCoins: (amount: number) => boolean;
  unlockChapter: (chapterId: string, cost: number) => { success: boolean; error?: string };
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
      addCoins: (amount) =>
        set((state) => ({
          profile: state.profile ? { ...state.profile, coins: state.profile.coins + amount } : null,
        })),
      deductCoins: (amount) => {
        const { profile } = get();
        if (!profile || profile.coins < amount) return false;
        set({
          profile: { ...profile, coins: profile.coins - amount },
        });
        return true;
      },
      unlockChapter: (chapterId, cost) => {
        const { profile, unlockedChapters, deductCoins } = get();
        if (unlockedChapters.includes(chapterId)) return { success: true };
        
        if (!profile || profile.coins < cost) {
          return { success: false, error: "Insufficient coins" };
        }

        if (deductCoins(cost)) {
          set({ unlockedChapters: [...unlockedChapters, chapterId] });
          return { success: true };
        }
        
        return { success: false, error: "Transaction failed" };
      },
      isChapterUnlocked: (chapterId) => {
        return get().unlockedChapters.includes(chapterId);
      },
      logout: () => set({ profile: null, unlockedChapters: [] }),
    }),
    {
      name: "user-storage",
    }
  )
);
