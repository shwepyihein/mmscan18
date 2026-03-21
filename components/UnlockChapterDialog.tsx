import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, Star, AlertCircle } from "lucide-react";
import { useRouter } from "next/router";
import { useUserStore } from "@/store/useUserStore";

interface UnlockChapterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapter: {
    id: string;
    number: number;
    price: number;
    manhwaTitle: string;
  } | null;
  onSuccess: () => void;
}

export function UnlockChapterDialog({ open, onOpenChange, chapter, onSuccess }: UnlockChapterDialogProps) {
  const router = useRouter();
  const { profile, unlockChapter } = useUserStore();
  const canAfford = profile && profile.coins >= (chapter?.price || 0);

  const handleUnlock = () => {
    if (chapter) {
      const result = unlockChapter(chapter.id, chapter.price);
      if (result.success) {
        onSuccess();
        onOpenChange(false);
      }
    }
  };

  if (!chapter) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-900 w-[90%] rounded-3xl p-6 gap-8 max-w-sm">
        <DialogHeader className="items-center text-center">
          <div className="w-16 h-16 rounded-full bg-amber-400/10 flex items-center justify-center text-amber-500 mb-2">
            <Lock className="w-8 h-8" />
          </div>
          <DialogTitle className="text-xl font-black text-zinc-50 uppercase tracking-tight">
            Unlock Chapter
          </DialogTitle>
          <DialogDescription className="text-zinc-500 font-medium text-xs">
            Unlock <span className="text-zinc-100 font-bold">Chapter {chapter.number}</span> of <span className="text-zinc-100 font-bold">{chapter.manhwaTitle}</span> to read.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="bg-zinc-900/50 border border-zinc-900 rounded-2xl p-6 flex flex-col items-center gap-2">
            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Price to Unlock</span>
            <div className="flex items-center gap-2">
              <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
              <span className="text-3xl font-black text-zinc-50 tracking-tighter">{chapter.price} Coins</span>
            </div>
          </div>

          {!canAfford && (
            <div className="flex items-center gap-3 p-4 bg-red-500/5 border border-red-500/10 rounded-xl">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div className="flex flex-col">
                <p className="text-[11px] text-red-500 font-bold uppercase tracking-widest">Insufficient Coins</p>
                <p className="text-[10px] text-zinc-500 font-medium leading-none">Your balance: {profile?.coins || 0} Coins</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-3">
          {canAfford ? (
            <Button 
              onClick={handleUnlock}
              className="w-full bg-violet-600 hover:bg-violet-700 h-14 text-sm font-black rounded-xl uppercase tracking-widest shadow-lg shadow-violet-900/20"
            >
              Unlock Now
            </Button>
          ) : (
            <Button 
              onClick={() => {
                onOpenChange(false);
                router.push("/shop");
              }}
              className="w-full bg-zinc-50 hover:bg-zinc-200 text-zinc-950 h-14 text-sm font-black rounded-xl uppercase tracking-widest"
            >
              Get More Coins
            </Button>
          )}
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="h-10 text-zinc-600 font-bold uppercase tracking-widest text-[10px]"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
