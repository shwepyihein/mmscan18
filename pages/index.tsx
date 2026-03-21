import Head from "next/head";
import { useEffect, useState } from "react";
import {
  getManhwasPaginated,
  type Manhwa,
  type ManhwaListMeta,
} from "@/api/manhwa";
import { ManhwaCard } from "@/components/ManhwaCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Loader2 } from "lucide-react";

const PAGE_SIZE = 20;

function mergeUnique(existing: Manhwa[], incoming: Manhwa[]): Manhwa[] {
  const seen = new Set(existing.map((m) => m.id));
  const out = [...existing];
  for (const m of incoming) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      out.push(m);
    }
  }
  return out;
}

function shouldLoadMore(
  mergedLength: number,
  meta: ManhwaListMeta | undefined,
  lastPageItemCount: number,
  limit: number,
): boolean {
  if (meta?.totalPages != null && meta.page != null) {
    return meta.page < meta.totalPages;
  }
  if (typeof meta?.total === "number") {
    return mergedLength < meta.total;
  }
  return lastPageItemCount >= limit;
}

export default function Home() {
  const [manhwas, setManhwas] = useState<Manhwa[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const { items, meta } = await getManhwasPaginated({
          page: 1,
          limit: PAGE_SIZE,
          sortBy: "latest",
        });
        if (cancelled) return;
        setManhwas(items);
        setPage(1);
        setHasMore(shouldLoadMore(items.length, meta, items.length, PAGE_SIZE));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLoadMore = async () => {
    if (!hasMore || isLoadingMore || isLoading) return;
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const { items, meta } = await getManhwasPaginated({
        page: nextPage,
        limit: PAGE_SIZE,
        sortBy: "latest",
      });
      setManhwas((prev) => {
        const merged = mergeUnique(prev, items);
        setHasMore(
          shouldLoadMore(merged.length, meta, items.length, PAGE_SIZE),
        );
        return merged;
      });
      setPage(nextPage);
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <>
      <Head>
        <title>hotManhwammhub | Discover Premium Manhwa</title>
      </Head>
      <div className="flex flex-col gap-8 p-4 pb-24">
        <header className="flex flex-col gap-1 py-4">
          <h1 className="text-3xl font-extrabold text-zinc-50 tracking-tight">
            Discovery
          </h1>
          <p className="text-zinc-500 text-sm font-medium">
            Explore the latest and greatest manhwas.
          </p>
        </header>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              New Releases
            </h2>
          </div>

          <div className="flex flex-col gap-3">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex flex-row gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-3"
                  >
                    <Skeleton className="h-[112px] w-[78px] shrink-0 rounded-xl bg-zinc-800" />
                    <div className="flex flex-1 flex-col justify-center gap-3 py-1">
                      <Skeleton className="h-5 w-full max-w-[220px] bg-zinc-800" />
                      <Skeleton className="h-3 w-full bg-zinc-800/80" />
                      <Skeleton className="h-3 w-4/5 bg-zinc-800/80" />
                    </div>
                  </div>
                ))
              : manhwas.map((manhwa) => (
                  <ManhwaCard key={manhwa.id} manhwa={manhwa} />
                ))}
          </div>

          {!isLoading && hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleLoadMore()}
                disabled={isLoadingMore}
                className="min-w-[200px] border-zinc-800 bg-zinc-900/50 text-zinc-200 hover:bg-zinc-800 hover:text-zinc-50"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
          )}

          {!isLoading && manhwas.length === 0 && (
            <p className="text-center text-sm text-zinc-500 py-8">
              No manhwa found.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
