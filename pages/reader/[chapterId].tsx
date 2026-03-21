import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Menu, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  extractChapterManhwaTitle,
  extractChapterPageUrls,
  getManhwaChapterByNumber,
} from "@/api/manhwa";

export default function Reader() {
  const router = useRouter();
  const { chapterId, manhwaId } = router.query;
  const [showControls, setShowControls] = useState(true);
  const [pageUrls, setPageUrls] = useState<string[]>([]);
  const [seriesTitle, setSeriesTitle] = useState<string | undefined>(undefined);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">(
    "idle",
  );

  useEffect(() => {
    if (!router.isReady || !chapterId || !manhwaId) return;

    const mid = manhwaId as string;
    const num = parseInt(chapterId as string, 10);
    if (!Number.isFinite(num)) return;

    let cancelled = false;
    setLoadState("loading");
    (async () => {
      try {
        const data = await getManhwaChapterByNumber(mid, num);
        if (cancelled) return;
        setPageUrls(extractChapterPageUrls(data));
        setSeriesTitle(extractChapterManhwaTitle(data));
        setLoadState("idle");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router.isReady, chapterId, manhwaId]);

  useEffect(() => {
    const timer = setTimeout(() => setShowControls(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const missingParams = router.isReady && (!chapterId || !manhwaId);

  return (
    <>
      <Head>
        <title>Reading Chapter {chapterId} | hotManhwammhub</title>
      </Head>
      <div
        className="relative min-h-screen bg-zinc-950 flex flex-col items-center"
        onClick={() => setShowControls(!showControls)}
      >
        <div
          className={`fixed top-0 left-0 right-0 z-50 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-900 transition-transform duration-300 p-4 flex items-center justify-between ${showControls ? "translate-y-0" : "-translate-y-full"}`}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              router.back();
            }}
            className="text-zinc-400"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="flex flex-col items-center">
            <h1 className="text-sm font-black text-zinc-100 uppercase tracking-tight">
              Chapter {chapterId}
            </h1>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest line-clamp-1 max-w-[200px]">
              {seriesTitle ?? "—"}
            </span>
          </div>
          <Button variant="ghost" size="icon" className="text-zinc-400">
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex flex-col w-full max-w-2xl pt-16">
          {missingParams && (
            <p className="px-6 py-12 text-center text-sm text-zinc-500">
              Open this chapter from a series page so the reader can load images.
            </p>
          )}
          {loadState === "loading" && (
            <p className="px-6 py-12 text-center text-sm text-zinc-500">
              Loading chapter…
            </p>
          )}
          {loadState === "error" && (
            <p className="px-6 py-12 text-center text-sm text-red-400/90">
              Could not load this chapter. Check your connection and API URL.
            </p>
          )}
          {!missingParams &&
            loadState === "idle" &&
            pageUrls.length === 0 &&
            manhwaId && (
              <p className="px-6 py-12 text-center text-sm text-zinc-500">
                No page images in this chapter response.
              </p>
            )}
          {pageUrls.map((src, index) => (
            <div
              key={`${src}-${index}`}
              className="relative w-full aspect-[2/3] bg-zinc-900 border-b border-zinc-900/50"
            >
              <Image
                src={src}
                alt={`Page ${index + 1}`}
                fill
                className="object-contain"
                loading={index < 2 ? "eager" : "lazy"}
                unoptimized
              />
            </div>
          ))}
        </div>

        <div
          className={`fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur-2xl border-t border-zinc-800 transition-transform duration-300 p-4 pb-safe flex items-center justify-between ${showControls ? "translate-y-0" : "translate-y-full"}`}
        >
          <Button
            variant="ghost"
            className="text-zinc-400 gap-2 font-black text-[10px] uppercase tracking-[0.2em] px-6"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </Button>
          <Button variant="ghost" size="icon" className="text-zinc-400">
            <Menu className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            className="text-zinc-400 gap-2 font-black text-[10px] uppercase tracking-[0.2em] px-6"
          >
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {!showControls && pageUrls.length > 0 && (
          <div className="fixed bottom-4 right-4 bg-zinc-950/50 backdrop-blur-sm px-4 py-2 rounded-full border border-zinc-800 text-[10px] font-black text-zinc-500 pointer-events-none uppercase tracking-widest">
            {pageUrls.length} Pages
          </div>
        )}
      </div>
    </>
  );
}
