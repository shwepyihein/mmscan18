import {
  extractChapterPageUrls,
  extractChapterReaderMeta,
  extractMmJsonOverlayPages,
  extractMmJsonStyledPages,
  extractMmjsonRaw,
  getManhwaById,
  getManhwaChapterByNumber,
  getManhwaChaptersListNormalized,
  isChapterLockedForbiddenError,
  parseMmjsonToPageSubtitles,
  resolveChapterIdFromChaptersArray,
} from '@/api/manhwa';
import type {
  ChapterReadTextSettings,
  MmJsonOverlayBlock,
} from '@/api/manhwa/chapter-read';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { resolveEpisodeCoinPrice } from '@/lib/chapterPricing';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/store/useUserStore';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  Menu,
  Settings,
  Star,
} from 'lucide-react';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

interface ReaderChapter {
  chapterNo: number;
  pageUrls: string[];
  title?: string;
  isLocked: boolean;
  price: number;
  storeId: string;
  /** One subtitle block per page (from mmjson), when provided. */
  subtitleLines: string[];
  /** Per-page lines with API font/color settings when mmJson uses `texts[].settings`. */
  subtitleStyledPages?: Array<
    Array<{ text: string; settings?: ChapterReadTextSettings }>
  >;
  /** Per-page blocks with `box` [x,y,w,h] in natural pixels (ImageCleaner / API). */
  subtitleOverlayPages?: MmJsonOverlayBlock[][];
}

function mmSettingsToCss(settings?: ChapterReadTextSettings): CSSProperties {
  if (!settings) return {};
  const fs = settings.fontSize;
  const fontSize =
    typeof fs === 'number'
      ? `${fs}px`
      : typeof fs === 'string' && /^\d+(\.\d+)?$/.test(fs)
        ? `${fs}px`
        : fs;
  const lh = settings.lineHeight;
  const lineHeight =
    typeof lh === 'number' ? String(lh) : lh != null ? String(lh) : undefined;
  return {
    fontSize,
    fontFamily: settings.fontFamily,
    fontWeight: settings.fontWeight,
    textAlign: (settings.textAlign as CSSProperties['textAlign']) ?? 'center',
    color: settings.fontColor ?? settings.color,
    lineHeight,
  };
}

function padArrayToLength<T>(arr: T[], len: number, fill: T): T[] {
  const out = [...arr];
  while (out.length < len) out.push(fill);
  return out.slice(0, len);
}

/** `box` = [x, y, w, h] in natural pixels → same % math as ImageCleanerWorkspace `getBoxPercentages`. */
function boxToPercentStyle(
  box: [number, number, number, number],
  iw: number,
  ih: number,
): CSSProperties {
  if (iw <= 0 || ih <= 0) return {};
  const [x, y, w, h] = box;
  return {
    left: `${(x / iw) * 100}%`,
    top: `${(y / ih) * 100}%`,
    width: `${(w / iw) * 100}%`,
    height: `${(h / ih) * 100}%`,
  };
}

function resolvePrevChapterNo(
  current: number,
  meta: ReturnType<typeof extractChapterReaderMeta>,
): number | null {
  if (meta.prevChapterNo === null) return null;
  if (
    typeof meta.prevChapterNo === 'number' &&
    Number.isFinite(meta.prevChapterNo)
  ) {
    return meta.prevChapterNo;
  }
  return current > 1 ? current - 1 : null;
}

function resolveNextChapterNo(
  current: number,
  meta: ReturnType<typeof extractChapterReaderMeta>,
): number | null {
  if (meta.nextChapterNo === null) return null;
  if (
    typeof meta.nextChapterNo === 'number' &&
    Number.isFinite(meta.nextChapterNo)
  ) {
    return meta.nextChapterNo;
  }
  const max = meta.chaptersCount;
  if (max != null && current >= max) return null;
  return current + 1;
}

async function resolveMmjsonToSubtitles(
  raw: ReturnType<typeof extractMmjsonRaw>,
): Promise<string[]> {
  if (raw == null) return [];
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return [];
    if (/^https?:\/\//i.test(t)) {
      try {
        const res = await fetch(t);
        const j: unknown = await res.json();
        return parseMmjsonToPageSubtitles(j);
      } catch {
        return [];
      }
    }
    return parseMmjsonToPageSubtitles(raw);
  }
  return parseMmjsonToPageSubtitles(raw);
}

async function resolveMmjsonStyledPages(
  payload: unknown,
  raw: ReturnType<typeof extractMmjsonRaw>,
): Promise<Array<Array<{ text: string; settings?: ChapterReadTextSettings }>>> {
  const direct = extractMmJsonStyledPages(payload);
  if (direct.length > 0) return direct;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (/^https?:\/\//i.test(t)) {
      try {
        const res = await fetch(t);
        const j: unknown = await res.json();
        return extractMmJsonStyledPages({ mmJson: j });
      } catch {
        return [];
      }
    }
  }
  return [];
}

async function resolveMmjsonOverlayPages(
  payload: unknown,
  raw: ReturnType<typeof extractMmjsonRaw>,
): Promise<MmJsonOverlayBlock[][]> {
  const direct = extractMmJsonOverlayPages(payload);
  if (direct.some((p) => p.length > 0)) return direct;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (/^https?:\/\//i.test(t)) {
      try {
        const res = await fetch(t);
        const j: unknown = await res.json();
        return extractMmJsonOverlayPages({ mmJson: j });
      } catch {
        return [];
      }
    }
  }
  return [];
}

export default function Reader() {
  const router = useRouter();
  const { chapterId, manhwaId } = router.query;
  const [showControls, setShowControls] = useState(true);
  const [chapter, setChapter] = useState<ReaderChapter | null>(null);
  const [manhwaTitle, setManhwaTitle] = useState<string | undefined>(undefined);
  const [currentChapterNo, setCurrentChapterNo] = useState<number | null>(null);
  const [navPrev, setNavPrev] = useState<number | null>(null);
  const [navNext, setNavNext] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const unlockedChapters = useUserStore((s) => s.unlockedChapters);
  const { isChapterUnlocked, profile, unlockChapter } = useUserStore();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const loadSeq = useRef(0);
  /** Natural size per page index for positioning `box` overlays (editor uses same pixel space). */
  const [pageNaturalSizes, setPageNaturalSizes] = useState<
    Record<number, { w: number; h: number }>
  >({});

  const resetControlsTimer = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    setShowControls(true);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  const getChapterStoreId = (mId: string, chNo: number, chId?: string) =>
    chId ?? `${mId}_ch_${chNo}`;

  // Re-run when `unlockedChapters` updates so after wallet unlock we GET chapter again and show images.
  useEffect(() => {
    if (!router.isReady || !chapterId || !manhwaId) return;

    const mid = typeof manhwaId === 'string' ? manhwaId : manhwaId[0];
    if (!mid) return;

    const initialChNo = parseInt(chapterId as string, 10);
    if (!Number.isFinite(initialChNo)) return;

    const seq = ++loadSeq.current;
    let cancelled = false;
    setError(null);
    setIsLoading(true);
    setChapter(null);
    setNavPrev(null);
    setNavNext(null);

    (async () => {
      try {
        const data = await getManhwaChapterByNumber(mid, initialChNo);
        if (cancelled || seq !== loadSeq.current) return;

        const meta = extractChapterReaderMeta(data);
        const effectiveChNo = meta.chapterNo ?? initialChNo;
        const chapterApiId =
          meta.chapterApiId ??
          resolveChapterIdFromChaptersArray(data, effectiveChNo);
        setManhwaTitle(meta.manhwaTitle);
        setCurrentChapterNo(effectiveChNo);

        const pageUrls = extractChapterPageUrls(data);
        const pageCount = pageUrls.length;

        const mm = extractMmjsonRaw(data);
        const [subtitleLinesRaw, styledRaw, overlayRaw] = await Promise.all([
          resolveMmjsonToSubtitles(mm),
          resolveMmjsonStyledPages(data, mm),
          resolveMmjsonOverlayPages(data, mm),
        ]);
        if (cancelled || seq !== loadSeq.current) return;

        const subtitleLines = padArrayToLength(subtitleLinesRaw, pageCount, '');
        const subtitleStyledPages = padArrayToLength(styledRaw, pageCount, []);
        const subtitleOverlayPages = padArrayToLength(overlayRaw, pageCount, []);
        const hasStyled = subtitleStyledPages.some((p) => p.length > 0);
        const hasOverlayBoxes = subtitleOverlayPages.some((p) =>
          p.some((b) => b.box),
        );

        const price = resolveEpisodeCoinPrice(effectiveChNo, meta.coinPrice);
        const storeId = getChapterStoreId(mid, effectiveChNo, chapterApiId);
        const unlocked = isChapterUnlocked(storeId);
        const locked =
          meta.isLocked === true
            ? !unlocked
            : meta.isLocked === false
              ? false
              : price > 0 && !unlocked;

        setNavPrev(resolvePrevChapterNo(effectiveChNo, meta));
        setNavNext(resolveNextChapterNo(effectiveChNo, meta));

        setChapter({
          chapterNo: effectiveChNo,
          pageUrls,
          title: meta.chapterTitle,
          isLocked: locked,
          price,
          storeId,
          subtitleLines,
          subtitleStyledPages: hasStyled ? subtitleStyledPages : undefined,
          subtitleOverlayPages: hasOverlayBoxes ? subtitleOverlayPages : undefined,
        });
      } catch (e) {
        if (!cancelled && seq === loadSeq.current) {
          if (isChapterLockedForbiddenError(e)) {
            let title: string | undefined;
            let chapterApiId: string | undefined;
            try {
              const m = await getManhwaById(mid);
              title = m?.title;
              chapterApiId = m?.chapters?.find(
                (c) => c.chapterNo === initialChNo,
              )?.id;
            } catch {
              /* ignore */
            }
            if (!chapterApiId) {
              const list = await getManhwaChaptersListNormalized(mid);
              chapterApiId = list.find((c) => c.chapterNo === initialChNo)?.id;
            }
            const price = resolveEpisodeCoinPrice(initialChNo, undefined);
            const storeId = getChapterStoreId(mid, initialChNo, chapterApiId);
            setManhwaTitle(title);
            setCurrentChapterNo(initialChNo);
            setNavPrev(initialChNo > 1 ? initialChNo - 1 : null);
            setNavNext(null);
            setChapter({
              chapterNo: initialChNo,
              pageUrls: [],
              title: undefined,
              isLocked: true,
              price,
              storeId,
              subtitleLines: [],
            });
            setError(null);
          } else {
            setError('Could not load this chapter.');
          }
        }
      } finally {
        if (!cancelled && seq === loadSeq.current) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    router.isReady,
    chapterId,
    manhwaId,
    unlockedChapters,
    isChapterUnlocked,
  ]);

  useEffect(() => {
    setPageNaturalSizes({});
  }, [chapter]);

  useEffect(() => {
    setUnlockError(null);
  }, [chapter?.storeId]);

  const handleUnlockClick = async () => {
    if (!chapter) return;
    if (authLoading) return;
    if (!isAuthenticated) {
      void router.push(`/login?next=${encodeURIComponent(router.asPath)}`);
      return;
    }
    const balance = profile?.coinBalance ?? 0;
    if (balance < chapter.price) {
      void router.push('/shop');
      return;
    }
    setUnlockError(null);
    setUnlocking(true);
    try {
      const result = await unlockChapter(chapter.storeId, chapter.price);
      if (result.success) {
        /* Chapter load effect re-runs when `unlockedChapters` updates. */
      } else {
        setUnlockError(result.error ?? 'Could not unlock this chapter.');
      }
    } finally {
      setUnlocking(false);
    }
  };

  const goPrev = () => {
    if (navPrev == null) return;
    const mid =
      typeof manhwaId === 'string'
        ? manhwaId
        : Array.isArray(manhwaId)
          ? manhwaId[0]
          : '';
    if (!mid) return;
    void router.push(
      `/reader/${navPrev}?manhwaId=${encodeURIComponent(mid)}`,
    );
  };

  const goNext = () => {
    if (navNext == null) return;
    const mid =
      typeof manhwaId === 'string'
        ? manhwaId
        : Array.isArray(manhwaId)
          ? manhwaId[0]
          : '';
    if (!mid) return;
    void router.push(
      `/reader/${navNext}?manhwaId=${encodeURIComponent(mid)}`,
    );
  };

  if (error) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6 text-center'>
        <div className='mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-500'>
          <Settings className='h-8 w-8' />
        </div>
        <h2 className='mb-2 text-xl font-black uppercase tracking-tight text-zinc-50'>
          Oops!
        </h2>
        <p className='mb-6 max-w-xs text-sm text-zinc-500'>{error}</p>
        <Button
          onClick={() => router.back()}
          variant='outline'
          className='border-zinc-800 text-[10px] font-bold uppercase tracking-widest text-zinc-400'
        >
          Go Back
        </Button>
      </div>
    );
  }

  const atEnd =
    !isLoading && chapter != null && !chapter.isLocked && navNext === null;

  return (
    <>
      <Head>
        <title>
          {manhwaTitle ? `${manhwaTitle} - Ch ${currentChapterNo}` : 'Reader'} |
          hotManhwammhub
        </title>
      </Head>

      <div
        className='relative flex min-h-screen select-none flex-col items-center bg-zinc-950'
        onClick={resetControlsTimer}
      >
        <div
          className={cn(
            'fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-zinc-900 bg-zinc-950/90 p-4 backdrop-blur-md transition-transform duration-300',
            showControls ? 'translate-y-0' : '-translate-y-full',
          )}
        >
          <Button
            variant='ghost'
            size='icon'
            onClick={(e) => {
              e.stopPropagation();
              router.back();
            }}
            className='text-zinc-400'
          >
            <ChevronLeft className='h-6 w-6' />
          </Button>
          <div className='flex flex-col items-center'>
            <h1 className='text-sm font-black uppercase tracking-tight text-zinc-100'>
              Chapter {currentChapterNo}
            </h1>
            <span className='line-clamp-1 max-w-[200px] text-[10px] font-bold uppercase tracking-widest text-zinc-500'>
              {manhwaTitle ?? '—'}
            </span>
          </div>
          <div className='flex items-center gap-1'>
            {isAuthenticated ? (
              <Link
                href='/shop'
                onClick={(e) => e.stopPropagation()}
                aria-label='Coins balance, open shop'
                title={`${profile?.coinBalance ?? 0} coins — Shop`}
                className={cn(
                  'flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-amber-400/15 bg-amber-400/[0.07] pl-1.5 pr-2.5',
                  'text-zinc-50 transition-opacity active:opacity-90',
                )}
              >
                <span className='flex h-7 w-7 items-center justify-center rounded-full bg-amber-400/12'>
                  <Star className='h-3.5 w-3.5 fill-amber-500 text-amber-500' />
                </span>
                <span className='min-w-[1.25rem] text-[11px] font-black tabular-nums'>
                  {authLoading ? '…' : (profile?.coinBalance ?? 0)}
                </span>
              </Link>
            ) : null}
            <Button variant='ghost' size='icon' className='text-zinc-400'>
              <Settings className='h-5 w-5' />
            </Button>
          </div>
        </div>

        <div className='flex w-full max-w-2xl flex-col'>
          {isLoading ? (
            <div className='flex min-h-screen flex-col items-center justify-center gap-4'>
              <Loader2 className='h-8 w-8 animate-spin text-violet-500' />
              <p className='text-[10px] font-black uppercase tracking-widest text-zinc-600'>
                Loading Chapter...
              </p>
            </div>
          ) : chapter?.isLocked ? (
            <div className='flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-24 text-center'>
              <div className='flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/10 text-amber-500'>
                <Lock className='h-8 w-8' />
              </div>
              <div className='flex flex-col gap-2'>
                <h3 className='text-xl font-black uppercase tracking-tight text-zinc-50'>
                  Chapter {chapter.chapterNo} is locked
                </h3>
                <p className='text-xs font-medium text-zinc-500'>
                  Unlock to read this chapter.
                </p>
              </div>
              <div className='flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-6 py-3'>
                <Star className='h-5 w-5 fill-amber-500 text-amber-500' />
                <span className='text-xl font-black text-zinc-50'>
                  {chapter.price} Coins
                </span>
              </div>
              {isAuthenticated ? (
                <p className='text-[11px] font-medium text-zinc-500'>
                  Your balance:{' '}
                  <span className='font-bold tabular-nums text-zinc-300'>
                    {authLoading ? '…' : (profile?.coinBalance ?? 0)}
                  </span>{' '}
                  Coins
                </p>
              ) : (
                <p className='max-w-sm text-[11px] font-medium text-zinc-500'>
                  Sign in to use coins and unlock this chapter.
                </p>
              )}
              {!isAuthenticated ? (
                <Button
                  asChild
                  variant='outline'
                  className='h-14 w-full max-w-sm rounded-2xl border-zinc-700 text-sm font-black uppercase tracking-widest text-zinc-200 hover:bg-zinc-900'
                >
                  <Link
                    href={`/login?next=${encodeURIComponent(router.asPath)}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Sign in
                  </Link>
                </Button>
              ) : null}
              {unlockError ? (
                <div className='flex max-w-sm items-center gap-3 rounded-xl border border-red-500/10 bg-red-500/5 p-4 text-left'>
                  <AlertCircle className='h-5 w-5 shrink-0 text-red-500' />
                  <p className='text-[11px] font-medium text-red-400'>
                    {unlockError}
                  </p>
                </div>
              ) : null}
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  void handleUnlockClick();
                }}
                disabled={unlocking || authLoading}
                className='h-14 w-full max-w-sm rounded-2xl bg-violet-600 text-sm font-black uppercase tracking-widest shadow-lg shadow-violet-900/20 hover:bg-violet-700 disabled:opacity-50'
              >
                {unlocking ? (
                  <>
                    <Loader2 className='mr-2 inline h-5 w-5 animate-spin' />
                    Unlocking…
                  </>
                ) : (
                  'Unlock chapter'
                )}
              </Button>
            </div>
          ) : chapter ? (
            <div className='flex w-full flex-col border-b-8 border-zinc-950'>
              <div className='flex items-center justify-between bg-zinc-900/50 px-6 py-4'>
                <span className='text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500'>
                  Chapter {chapter.chapterNo}
                </span>
                {chapter.title ? (
                  <span className='max-w-[60%] truncate text-[10px] font-bold uppercase tracking-widest text-zinc-600'>
                    {chapter.title}
                  </span>
                ) : null}
              </div>

              {chapter.pageUrls.map((src, idx) => {
                const overlayPage = chapter.subtitleOverlayPages?.[idx];
                const boxed =
                  overlayPage?.filter((b) => b.box != null) ?? [];
                const unboxed =
                  overlayPage?.filter((b) => !b.box && b.text.trim()) ?? [];
                const hasPixelBoxes = boxed.length > 0;
                const nat = pageNaturalSizes[idx];
                const showUnderImageStack =
                  !hasPixelBoxes &&
                  (chapter.subtitleStyledPages?.[idx]?.some((l) =>
                    l.text.trim(),
                  ) ||
                    !!chapter.subtitleLines[idx]?.trim());

                return (
                  <div
                    key={`${chapter.chapterNo}-${idx}`}
                    className='relative w-full'
                  >
                    <Image
                      src={src}
                      alt={`Ch ${chapter.chapterNo} - Page ${idx + 1}`}
                      width={0}
                      height={0}
                      sizes='100vw'
                      style={{ width: '100%', height: 'auto' }}
                      className='block'
                      loading={idx < 3 ? 'eager' : 'lazy'}
                      unoptimized
                      onLoadingComplete={(img) => {
                        const w = img.naturalWidth;
                        const h = img.naturalHeight;
                        if (w > 0 && h > 0) {
                          setPageNaturalSizes((prev) => ({
                            ...prev,
                            [idx]: { w, h },
                          }));
                        }
                      }}
                    />
                    {hasPixelBoxes && nat
                      ? boxed.map((b, bi) =>
                          b.box ? (
                            <div
                              key={bi}
                              className='pointer-events-none absolute flex items-center justify-center overflow-hidden p-0.5'
                              style={boxToPercentStyle(b.box, nat.w, nat.h)}
                            >
                              {b.text.trim() ? (
                                <p
                                  className='max-h-full w-full overflow-hidden text-sm font-medium leading-tight text-zinc-100'
                                  style={mmSettingsToCss(b.settings)}
                                >
                                  {b.text}
                                </p>
                              ) : null}
                            </div>
                          ) : null,
                        )
                      : null}
                    {unboxed.length > 0 ? (
                      <div className='border-t border-zinc-800/80 bg-zinc-950/95 px-4 py-3 text-center'>
                        {unboxed.map((line, li) => (
                          <p
                            key={li}
                            className='text-sm font-medium leading-relaxed text-zinc-200'
                            style={mmSettingsToCss(line.settings)}
                          >
                            {line.text}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    {showUnderImageStack ? (
                      chapter.subtitleStyledPages?.[idx]?.some((l) =>
                        l.text.trim(),
                      ) ? (
                        <div className='border-t border-zinc-800/80 bg-zinc-950/95 px-4 py-3 text-center'>
                          {chapter.subtitleStyledPages[idx].map((line, li) =>
                            line.text.trim() ? (
                              <p
                                key={li}
                                className='text-sm font-medium leading-relaxed text-zinc-200'
                                style={mmSettingsToCss(line.settings)}
                              >
                                {line.text}
                              </p>
                            ) : null,
                          )}
                        </div>
                      ) : chapter.subtitleLines[idx]?.trim() ? (
                        <div className='border-t border-zinc-800/80 bg-zinc-950/95 px-4 py-3 text-center'>
                          <p className='text-sm font-medium leading-relaxed text-zinc-200'>
                            {chapter.subtitleLines[idx]}
                          </p>
                        </div>
                      ) : null
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          {atEnd ? (
            <div className='flex flex-col items-center gap-4 p-20 pb-40 text-center'>
              <div className='flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-zinc-700'>
                <Menu className='h-6 w-6' />
              </div>
              <p className='text-[10px] font-black uppercase tracking-widest text-zinc-600'>
                You&apos;ve reached the latest chapter.
              </p>
              <Button
                onClick={() => router.back()}
                variant='link'
                className='text-[10px] font-black uppercase tracking-widest text-violet-500'
              >
                Return to series
              </Button>
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            'fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between border-t border-zinc-800 bg-zinc-900/95 p-4 pb-safe backdrop-blur-2xl transition-transform duration-300',
            showControls ? 'translate-y-0' : 'translate-y-full',
          )}
        >
          <Button
            variant='ghost'
            onClick={goPrev}
            disabled={navPrev == null || isLoading}
            className='gap-2 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 disabled:opacity-20'
          >
            <ChevronLeft className='h-4 w-4' /> Prev
          </Button>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => {
              const mid =
                typeof manhwaId === 'string'
                  ? manhwaId
                  : Array.isArray(manhwaId)
                    ? manhwaId[0]
                    : '';
              if (mid) void router.push(`/manhwa/${mid}`);
            }}
            className='text-zinc-400'
          >
            <Menu className='h-5 w-5' />
          </Button>
          <Button
            variant='ghost'
            onClick={goNext}
            disabled={navNext == null || isLoading}
            className='gap-2 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 disabled:opacity-20'
          >
            Next <ChevronRight className='h-4 w-4' />
          </Button>
        </div>

        {!showControls && !isLoading && chapter && !chapter.isLocked ? (
          <div className='pointer-events-none fixed bottom-4 right-4 rounded-full border border-zinc-800 bg-zinc-950/50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 backdrop-blur-sm'>
            {chapter.pageUrls.length} Pages
          </div>
        ) : null}
      </div>

    </>
  );
}
