import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Menu, Settings, Lock, Coins, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  extractChapterManhwaTitle,
  extractChapterPageUrls,
  getManhwaChapterByNumber,
  getManhwaById,
  type Manhwa,
  type ManhwaChapterSummary,
  getManhwaChaptersListNormalized,
} from "@/api/manhwa";
import { useUserStore } from "@/store/useUserStore";
import { resolveEpisodeCoinPrice } from "@/lib/chapterPricing";
import { UnlockChapterDialog } from "@/components/UnlockChapterDialog";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface LoadedChapter {
  chapterNo: number;
  pageUrls: string[];
  title?: string;
  isLocked: boolean;
  price: number;
  storeId: string;
}

export default function Reader() {
  const router = useRouter();
  const { chapterId, manhwaId } = router.query;
  const [showControls, setShowControls] = useState(true);
  const [loadedChapters, setLoadedChapters] = useState<LoadedChapter[]>([]);
  const [manhwa, setManhwa] = useState<Manhwa | undefined>(undefined);
  const [chaptersList, setChaptersList] = useState<ManhwaChapterSummary[]>([]);
  const [currentChapterNo, setCurrentChapterNo] = useState<number | null>(null);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Unlock Dialog State
  const [isUnlockDialogOpen, setIsUnlockDialogOpen] = useState(false);
  const [chapterToUnlock, setChapterToUnlock] = useState<{
    id: string;
    number: number;
    price: number;
    manhwaTitle: string;
  } | null>(null);

  const { isChapterUnlocked } = useUserStore();
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const chapterRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const resetControlsTimer = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    setShowControls(true);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  const getChapterStoreId = (mId: string, chNo: number, chId?: string) => 
    chId ?? `${mId}_ch_${chNo}`;

  const loadChapterData = useCallback(async (mId: string, chNo: number): Promise<LoadedChapter | null> => {
    try {
      const data = await getManhwaChapterByNumber(mId, chNo);
      const chSummary = chaptersList.find(c => c.chapterNo === chNo);
      const price = resolveEpisodeCoinPrice(chNo, chSummary?.coinPrice);
      const storeId = getChapterStoreId(mId, chNo, chSummary?.id);
      
      return {
        chapterNo: chNo,
        pageUrls: extractChapterPageUrls(data),
        title: extractChapterManhwaTitle(data),
        isLocked: price > 0 && !isChapterUnlocked(storeId),
        price,
        storeId,
      };
    } catch (err) {
      console.error(`Failed to load chapter ${chNo}:`, err);
      return null;
    }
  }, [chaptersList, isChapterUnlocked]);

  // Initial Load
  useEffect(() => {
    if (!router.isReady || !chapterId || !manhwaId) return;

    const mid = manhwaId as string;
    const initialChNo = parseInt(chapterId as string, 10);
    if (!Number.isFinite(initialChNo)) return;

    let cancelled = false;
    setError(null);

    (async () => {
      try {
        const [mDetail, cList] = await Promise.all([
          getManhwaById(mid),
          getManhwaChaptersListNormalized(mid)
        ]);
        
        if (cancelled) return;
        setManhwa(mDetail);
        setChaptersList(cList);

        const firstCh = await loadChapterData(mid, initialChNo);
        if (cancelled) return;

        if (firstCh) {
          setLoadedChapters([firstCh]);
          setCurrentChapterNo(initialChNo);
        } else {
          setError("Could not load chapter. It might be locked or unavailable.");
        }
      } catch (err) {
        if (!cancelled) setError("An error occurred while loading the reader.");
      }
    })();

    return () => { cancelled = true; };
  }, [router.isReady, chapterId, manhwaId, loadChapterData]);

  // Intersection Observer for Infinite Scroll and URL Sync
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const chNo = parseInt(entry.target.getAttribute("data-chapter") || "0", 10);
          if (chNo > 0) {
            setCurrentChapterNo(chNo);
            // Update URL without refreshing
            window.history.replaceState(null, "", `/reader/${chNo}?manhwaId=${manhwaId}`);
          }

          // Trigger load next if it's the last chapter's bottom marker
          if (entry.target.getAttribute("data-marker") === "bottom") {
            handleLoadNext();
          }
        }
      });
    }, { threshold: 0.1 });

    chapterRefs.current.forEach((el) => {
      if (el) observerRef.current?.observe(el);
    });

    const bottomMarkers = document.querySelectorAll("[data-marker='bottom']");
    bottomMarkers.forEach(el => observerRef.current?.observe(el));

    return () => observerRef.current?.disconnect();
  }, [loadedChapters, manhwaId, handleLoadNext]);

  const handleLoadNext = useCallback(async () => {
    if (!manhwa || !manhwaId || isLoadingNext) return;
    
    const lastCh = loadedChapters[loadedChapters.length - 1];
    if (!lastCh) return;

    const nextChNo = lastCh.chapterNo + 1;
    if (nextChNo > manhwa.chaptersCount) return;

    // Check if next chapter is in our list and if it's locked
    const nextSummary = chaptersList.find(c => c.chapterNo === nextChNo);
    const nextPrice = resolveEpisodeCoinPrice(nextChNo, nextSummary?.coinPrice);
    const nextStoreId = getChapterStoreId(manhwaId as string, nextChNo, nextSummary?.id);
    
    if (nextPrice > 0 && !isChapterUnlocked(nextStoreId)) {
      // Don't auto-load locked chapters, UI will show "Next Chapter (Locked)"
      return;
    }

    setIsLoadingNext(true);
    const nextCh = await loadChapterData(manhwaId as string, nextChNo);
    if (nextCh) {
      setLoadedChapters(prev => [...prev, nextCh]);
    }
    setIsLoadingNext(false);
  }, [manhwa, manhwaId, isLoadingNext, loadedChapters, chaptersList, isChapterUnlocked, loadChapterData]);

  const handleUnlockClick = (ch: LoadedChapter | { chapterNo: number, price: number, storeId: string }) => {
    if (!manhwa) return;
    setChapterToUnlock({
      id: 'storeId' in ch ? ch.storeId : (ch as any).storeId, // Type safety
      number: ch.chapterNo,
      price: ch.price,
      manhwaTitle: manhwa.title
    });
    setIsUnlockDialogOpen(true);
  };

  const scrollToChapter = (chNo: number) => {
    const el = chapterRefs.current.get(chNo);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    if (!currentChapterNo) return;
    const prevNo = currentChapterNo - 1;
    if (prevNo < 1) return;
    
    const alreadyLoaded = loadedChapters.find(c => c.chapterNo === prevNo);
    if (alreadyLoaded) {
      scrollToChapter(prevNo);
    } else {
      // For simplicity, if not loaded (user jumped), redirect
      router.push(`/reader/${prevNo}?manhwaId=${manhwaId}`);
    }
  };

  const handleNext = () => {
    if (!currentChapterNo) return;
    const nextNo = currentChapterNo + 1;
    if (manhwa && nextNo > manhwa.chaptersCount) return;

    const alreadyLoaded = loadedChapters.find(c => c.chapterNo === nextNo);
    if (alreadyLoaded) {
      scrollToChapter(nextNo);
    } else {
      handleLoadNext();
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-4">
          <Settings className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-zinc-50 uppercase tracking-tight mb-2">Oops!</h2>
        <p className="text-sm text-zinc-500 max-w-xs mb-6">{error}</p>
        <Button onClick={() => router.back()} variant="outline" className="border-zinc-800 text-zinc-400 font-bold uppercase tracking-widest text-[10px]">
          Go Back
        </Button>
      </div>
    );
  }

  const isInitialLoading = loadedChapters.length === 0 && !error;

  return (
    <>
      <Head>
        <title>{manhwa ? `${manhwa.title} - Ch ${currentChapterNo}` : 'Reader'} | hotManhwammhub</title>
      </Head>

      <div 
        className="relative min-h-screen bg-zinc-950 flex flex-col items-center select-none"
        onClick={resetControlsTimer}
      >
        {/* Header */}
        <div
          className={cn(
            "fixed top-0 left-0 right-0 z-50 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-900 transition-transform duration-300 p-4 flex items-center justify-between",
            showControls ? "translate-y-0" : "-translate-y-full"
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); router.back(); }}
            className="text-zinc-400"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="flex flex-col items-center">
            <h1 className="text-sm font-black text-zinc-100 uppercase tracking-tight">
              Chapter {currentChapterNo}
            </h1>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest line-clamp-1 max-w-[200px]">
              {manhwa?.title ?? "—"}
            </span>
          </div>
          <Button variant="ghost" size="icon" className="text-zinc-400">
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        {/* Reader Content */}
        <div className="flex flex-col w-full max-w-2xl">
          {isInitialLoading ? (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Loading Chapter...</p>
            </div>
          ) : (
            loadedChapters.map((chapter) => (
              <div 
                key={chapter.chapterNo} 
                data-chapter={chapter.chapterNo}
                ref={(el) => { if (el) chapterRefs.current.set(chapter.chapterNo, el); }}
                className="flex flex-col w-full border-b-8 border-zinc-950"
              >
                {/* Chapter Divider */}
                <div className="bg-zinc-900/50 py-4 px-6 flex items-center justify-between">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                    Chapter {chapter.chapterNo}
                  </span>
                  {chapter.title && (
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest truncate max-w-[60%]">
                      {chapter.title}
                    </span>
                  )}
                </div>

                {chapter.pageUrls.map((src, idx) => (
                  <div key={`${chapter.chapterNo}-${idx}`} className="relative w-full">
                    <Image
                      src={src}
                      alt={`Ch ${chapter.chapterNo} - Page ${idx + 1}`}
                      width={0}
                      height={0}
                      sizes="100vw"
                      style={{ width: '100%', height: 'auto' }}
                      className="block"
                      loading={idx < 3 ? "eager" : "lazy"}
                      unoptimized
                    />
                  </div>
                ))}
                
                {/* Bottom Marker for Infinite Scroll */}
                <div data-chapter={chapter.chapterNo} data-marker="bottom" className="h-20 w-full" />
              </div>
            ))
          )}

          {/* Locked Next Chapter Prompt */}
          {!isInitialLoading && manhwa && loadedChapters[loadedChapters.length - 1]?.chapterNo < manhwa.chaptersCount && (
            <div className="p-8 pb-32 flex flex-col items-center gap-6 text-center">
              {(() => {
                const lastLoadedNo = loadedChapters[loadedChapters.length - 1].chapterNo;
                const nextNo = lastLoadedNo + 1;
                const nextSummary = chaptersList.find(c => c.chapterNo === nextNo);
                const nextPrice = resolveEpisodeCoinPrice(nextNo, nextSummary?.coinPrice);
                const nextStoreId = getChapterStoreId(manhwaId as string, nextNo, nextSummary?.id);
                const isNextLocked = nextPrice > 0 && !isChapterUnlocked(nextStoreId);

                if (isNextLocked) {
                  return (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-8 flex flex-col items-center gap-6 shadow-2xl"
                    >
                      <div className="w-16 h-16 rounded-full bg-amber-400/10 flex items-center justify-center text-amber-500">
                        <Lock className="w-8 h-8" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <h3 className="text-xl font-black text-zinc-50 uppercase tracking-tight">Chapter {nextNo} is Locked</h3>
                        <p className="text-xs text-zinc-500 font-medium">Unlock this chapter to continue reading the story.</p>
                      </div>
                      <div className="flex items-center gap-2 bg-zinc-950 px-6 py-3 rounded-2xl border border-zinc-800">
                        <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                        <span className="text-xl font-black text-zinc-50">{nextPrice} Coins</span>
                      </div>
                      <Button 
                        onClick={() => handleUnlockClick({ chapterNo: nextNo, price: nextPrice, storeId: nextStoreId })}
                        className="w-full bg-violet-600 hover:bg-violet-700 h-14 text-sm font-black rounded-2xl uppercase tracking-widest shadow-lg shadow-violet-900/20"
                      >
                        Unlock to Continue
                      </Button>
                    </motion.div>
                  );
                }

                if (isLoadingNext) {
                  return (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
                      <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Loading Next Chapter...</span>
                    </div>
                  );
                }

                return (
                  <Button 
                    variant="ghost"
                    onClick={handleLoadNext}
                    className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] hover:text-zinc-300"
                  >
                    Scroll to Load Next Chapter
                  </Button>
                );
              })()}
            </div>
          )}

          {/* End of Story */}
          {!isInitialLoading && manhwa && loadedChapters[loadedChapters.length - 1]?.chapterNo === manhwa.chaptersCount && (
            <div className="p-20 pb-40 flex flex-col items-center gap-4 text-center">
              <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-700">
                <Menu className="w-6 h-6" />
              </div>
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">You&apos;ve reached the end of the current chapters.</p>
              <Button onClick={() => router.back()} variant="link" className="text-violet-500 font-black uppercase text-[10px] tracking-widest">Return to Series</Button>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur-2xl border-t border-zinc-800 transition-transform duration-300 p-4 pb-safe flex items-center justify-between",
            showControls ? "translate-y-0" : "translate-y-full"
          )}
        >
          <Button
            variant="ghost"
            onClick={handlePrev}
            disabled={currentChapterNo === 1}
            className="text-zinc-400 gap-2 font-black text-[10px] uppercase tracking-[0.2em] px-6 disabled:opacity-20"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </Button>
          <Button variant="ghost" size="icon" onClick={() => router.push(`/manhwa/${manhwaId}`)} className="text-zinc-400">
            <Menu className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            onClick={handleNext}
            disabled={manhwa && currentChapterNo === manhwa.chaptersCount}
            className="text-zinc-400 gap-2 font-black text-[10px] uppercase tracking-[0.2em] px-6 disabled:opacity-20"
          >
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Page Count Float */}
        {!showControls && !isInitialLoading && (
          <div className="fixed bottom-4 right-4 bg-zinc-950/50 backdrop-blur-sm px-4 py-2 rounded-full border border-zinc-800 text-[10px] font-black text-zinc-500 pointer-events-none uppercase tracking-widest">
             {loadedChapters.find(c => c.chapterNo === currentChapterNo)?.pageUrls.length || 0} Pages
          </div>
        )}
      </div>

      <UnlockChapterDialog 
        open={isUnlockDialogOpen}
        onOpenChange={setIsUnlockDialogOpen}
        chapter={chapterToUnlock}
        onSuccess={() => {
          // After unlock, we can auto-load next or refresh the current view
          if (chapterToUnlock) {
            handleLoadNext();
          }
        }}
      />
    </>
  );
}

// Re-using Star icon for Coins
function Star(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
