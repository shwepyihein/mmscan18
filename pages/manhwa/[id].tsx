import {
  getEpisodesForDetail,
  getManhwaById,
  isChapterNewByPublishedAt,
  type Manhwa,
  type ManhwaChapterSummary,
} from '@/api/manhwa';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UnlockChapterDialog } from '@/components/UnlockChapterDialog';
import {
  FREE_CHAPTER_THROUGH,
  resolveEpisodeCoinPrice,
} from '@/lib/chapterPricing';
import { useUserStore } from '@/store/useUserStore';
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coins,
  Flame,
  Lock,
  Star,
} from 'lucide-react';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

function formatChapterDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ManhwaDetails() {
  const router = useRouter();
  const { id } = router.query;
  const [manhwa, setManhwa] = useState<Manhwa | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChapter, setSelectedChapter] = useState<{
    id: string;
    number: number;
    price: number;
    manhwaTitle: string;
  } | null>(null);
  const [isUnlockDialogOpen, setIsUnlockDialogOpen] = useState(false);

  const { isChapterUnlocked } = useUserStore();

  useEffect(() => {
    if (!router.isReady || !id) return;
    let cancelled = false;
    setIsLoading(true);
    getManhwaById(id as string)
      .then((data) => {
        if (!cancelled) setManhwa(data);
      })
      .catch(() => {
        if (!cancelled) setManhwa(undefined);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router.isReady, id]);

  const episodes = useMemo(
    () => (manhwa ? getEpisodesForDetail(manhwa) : []),
    [manhwa],
  );

  const firstChapterNo = useMemo(() => {
    if (!manhwa) return 1;
    if (manhwa.chapters?.length)
      return Math.min(...manhwa.chapters.map((c) => c.chapterNo));
    return manhwa.chaptersCount > 0 ? 1 : 1;
  }, [manhwa]);

  const resolveChapterPrice = (ch: ManhwaChapterSummary): number =>
    resolveEpisodeCoinPrice(ch.chapterNo, ch.coinPrice);

  const unlockKey = (ch: ManhwaChapterSummary) =>
    ch.id ?? `${manhwa?.id ?? ''}_ch_${ch.chapterNo}`;

  const handleChapterClick = (ch: ManhwaChapterSummary) => {
    if (!manhwa?.id) return;
    const chapterNum = ch.chapterNo;
    const price = resolveChapterPrice(ch);
    const chapterStoreId = unlockKey(ch);

    if (price === 0 || isChapterUnlocked(chapterStoreId)) {
      router.push(
        `/reader/${chapterNum}?manhwaId=${encodeURIComponent(manhwa.id)}`,
      );
    } else {
      setSelectedChapter({
        id: chapterStoreId,
        number: chapterNum,
        price,
        manhwaTitle: manhwa.title || '',
      });
      setIsUnlockDialogOpen(true);
    }
  };

  if (isLoading) {
    return (
      <div className='flex flex-col gap-6 p-4'>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='h-10 w-10 shrink-0 rounded-full border border-zinc-800 bg-zinc-900/80 text-zinc-100 hover:bg-zinc-800'
          onClick={() => router.back()}
          aria-label='Back'
        >
          <ChevronLeft className='h-6 w-6' />
        </Button>
        <Skeleton className='aspect-[3/4] w-full rounded-2xl bg-zinc-900' />
        <Skeleton className='h-8 w-3/4 bg-zinc-900' />
        <Skeleton className='h-24 w-full bg-zinc-900' />
      </div>
    );
  }

  if (!manhwa) {
    return (
      <div className='flex flex-col gap-4 p-4'>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='h-10 w-10 shrink-0 rounded-full border border-zinc-800 bg-zinc-900/80 text-zinc-100 hover:bg-zinc-800'
          onClick={() => router.back()}
          aria-label='Back'
        >
          <ChevronLeft className='h-6 w-6' />
        </Button>
        <p className='text-center text-sm text-zinc-500'>Manhwa not found.</p>
      </div>
    );
  }

  const coverSrc = manhwa.coverImageUrl || '';

  return (
    <>
      <Head>
        <title>{manhwa.title} | hotManhwammhub</title>
      </Head>
      <div className='flex flex-col  bg-zinc-950'>
        <div className='relative w-full  h-[500px]  overflow-hidden'>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='absolute left-4 top-4 z-20 h-10 w-10 rounded-full border border-zinc-800/80 bg-zinc-950/60 text-zinc-100 backdrop-blur-md hover:bg-zinc-900/80'
            onClick={() => router.back()}
            aria-label='Back'
          >
            <ChevronLeft className='h-6 w-6' />
          </Button>
          {coverSrc ? (
            <>
              <Image
                src={coverSrc}
                alt={manhwa.title}
                fill
                className='object-cover blur-3xl opacity-20 scale-125'
                priority
              />
              <div className='absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent' />
            </>
          ) : (
            <div className='absolute inset-0 bg-zinc-900' />
          )}

          <div className='absolute inset-0 top-0 flex flex-col items-center justify-end p-6 gap-6'>
            <div className='relative aspect-[2/3] w-48 rounded-xl overflow-hidden border border-zinc-800 shadow-2xl shadow-zinc-950/50 bg-zinc-900'>
              {coverSrc ? (
                <Image
                  src={coverSrc}
                  alt={manhwa.title}
                  fill
                  className='object-cover'
                  priority
                />
              ) : (
                <div className='absolute inset-0 flex items-center justify-center text-[10px] font-bold text-zinc-600 p-4 text-center'>
                  No cover
                </div>
              )}
            </div>

            <div className='flex flex-col items-center gap-2 text-center'>
              <h1 className='text-2xl font-black text-zinc-50 tracking-tight leading-none uppercase'>
                {manhwa.title}
              </h1>
              {manhwa.genres && manhwa.genres.length > 0 ? (
                <div className='flex flex-wrap justify-center gap-1.5'>
                  {manhwa.genres.slice(0, 6).map((g) => (
                    <span
                      key={g}
                      className='rounded-full border border-zinc-800 bg-zinc-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400'
                    >
                      {g}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className='flex items-center gap-3'>
                <div className='flex items-center gap-1'>
                  <Star className='w-4 h-4 text-amber-400 fill-amber-400' />
                  <span className='text-sm font-bold text-zinc-100'>
                    {manhwa.rating}
                  </span>
                </div>
                <div className='w-1 h-1 rounded-full bg-zinc-700' />
                <span className='text-sm font-medium text-zinc-400'>
                  {manhwa.author || '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className='flex gap-4 p-4 sticky top-0 bg-zinc-950/80 backdrop-blur-md z-10 border-b border-zinc-900/50'>
          <Button
            disabled={episodes.length === 0}
            onClick={() => {
              const first = episodes.find(
                (e) => e.chapterNo === firstChapterNo,
              ) ?? {
                chapterNo: firstChapterNo,
              };
              handleChapterClick(first);
            }}
            className='flex-grow bg-violet-600 hover:bg-violet-700 h-12 text-sm font-black rounded-xl gap-2 shadow-lg shadow-violet-900/20 uppercase tracking-widest disabled:opacity-40'
          >
            <BookOpen className='w-5 h-5' />
            READ FIRST
          </Button>
          <Button
            variant='outline'
            className='w-12 h-12 rounded-xl border-zinc-800 bg-zinc-900 hover:bg-zinc-800 p-0 shadow-lg'
          >
            <Flame className='w-5 h-5 text-amber-400' />
          </Button>
        </div>

        <Tabs defaultValue='chapters' className='flex flex-col w-full'>
          <TabsList className='bg-transparent border-b border-zinc-900 w-full justify-start px-4 h-12 gap-8 rounded-none'>
            <TabsTrigger
              value='chapters'
              className='bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-violet-500 rounded-none h-12 px-0 text-[11px] font-black text-zinc-600 data-[state=active]:text-zinc-50 uppercase tracking-[0.2em]'
            >
              Episodes
            </TabsTrigger>
            <TabsTrigger
              value='info'
              className='bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-violet-500 rounded-none h-12 px-0 text-[11px] font-black text-zinc-600 data-[state=active]:text-zinc-50 uppercase tracking-[0.2em]'
            >
              Synopsis
            </TabsTrigger>
          </TabsList>

          <TabsContent value='info' className='p-8'>
            <p className='text-zinc-400 text-[13px] leading-relaxed font-medium whitespace-pre-wrap'>
              {manhwa.synopsis || 'No synopsis.'}
            </p>
          </TabsContent>

          <TabsContent
            value='chapters'
            className='flex flex-col divide-y divide-zinc-900/50'
          >
            {episodes.length === 0 ? (
              <p className='p-8 text-center text-sm text-zinc-500'>
                No episodes yet.
              </p>
            ) : (
              episodes.map((ch) => {
                const price = resolveChapterPrice(ch);
                const storeId = unlockKey(ch);
                const isUnlocked = price === 0 || isChapterUnlocked(storeId);
                const dateLabel = formatChapterDate(ch.publishedAt);

                return (
                  <div
                    key={ch.id ?? `ch-${ch.chapterNo}`}
                    className='flex items-center gap-4 p-5 active:bg-zinc-900/30 transition-colors cursor-pointer'
                    onClick={() => handleChapterClick(ch)}
                    role='button'
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ')
                        handleChapterClick(ch);
                    }}
                  >
                    <div className='relative w-16 aspect-square rounded-2xl bg-zinc-900 overflow-hidden flex-shrink-0 border border-zinc-800/50 shadow-inner'>
                      {coverSrc ? (
                        <Image
                          src={coverSrc}
                          alt={`Chapter ${ch.chapterNo}`}
                          fill
                          className={`object-cover ${!isUnlocked ? 'opacity-30' : 'opacity-60'}`}
                        />
                      ) : null}
                      <div className='absolute inset-0 flex items-center justify-center text-[11px] font-black text-zinc-500 tracking-tighter'>
                        #{ch.chapterNo}
                      </div>
                    </div>
                    <div className='flex flex-col flex-grow gap-0.5 min-w-0'>
                      <div className='flex items-center gap-2 flex-wrap'>
                        <h4 className='text-[13px] font-black text-zinc-200 uppercase tracking-tight'>
                          Episode {ch.chapterNo}
                        </h4>
                        {ch.chapterNo <= FREE_CHAPTER_THROUGH ? (
                          <span className='rounded bg-emerald-500/15 px-1.5 py-px text-[9px] font-black uppercase tracking-wider text-emerald-400'>
                            Free
                          </span>
                        ) : null}
                        {isChapterNewByPublishedAt(ch.publishedAt) ? (
                          <span className='rounded bg-cyan-500/15 px-1.5 py-px text-[9px] font-black uppercase tracking-wider text-cyan-400'>
                            New
                          </span>
                        ) : null}
                      </div>
                      {ch.title ? (
                        <span className='text-[11px] font-medium text-zinc-400 line-clamp-2'>
                          {ch.title}
                        </span>
                      ) : null}
                      <span className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest'>
                        {dateLabel ?? '—'}
                      </span>
                    </div>

                    {isUnlocked ? (
                      <div className='w-10 h-10 rounded-full flex items-center justify-center text-emerald-500/50 shrink-0'>
                        {price > 0 ? (
                          <CheckCircle2 className='w-5 h-5 text-emerald-500' />
                        ) : (
                          <ChevronRight className='w-5 h-5 text-zinc-800' />
                        )}
                      </div>
                    ) : (
                      <div className='flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-400/5 border border-amber-400/10 shrink-0'>
                        <Lock className='w-3.5 h-3.5 text-amber-500' />
                        <Coins className='w-3.5 h-3.5 text-amber-400' />
                        <span className='text-[10px] font-black text-amber-500'>
                          {price}{' '}
                          <span className='text-[8px] opacity-70'>Coins</span>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>

      <UnlockChapterDialog
        open={isUnlockDialogOpen}
        onOpenChange={setIsUnlockDialogOpen}
        chapter={selectedChapter}
        onSuccess={() => {
          if (selectedChapter && manhwa?.id) {
            router.push(
              `/reader/${selectedChapter.number}?manhwaId=${encodeURIComponent(manhwa.id)}`,
            );
          }
        }}
      />
    </>
  );
}
