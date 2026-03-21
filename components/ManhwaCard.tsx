import {
  Manhwa,
  getLastTwoChapters,
  isChapterNewByPublishedAt,
} from '@/api/manhwa';
import { BookMarked, Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface ManhwaCardProps {
  manhwa: Manhwa;
}

function readerHref(manhwaId: string, chapterNo: number) {
  return `/reader/${chapterNo}?manhwaId=${encodeURIComponent(manhwaId)}`;
}

export function ManhwaCard({ manhwa }: ManhwaCardProps) {
  const lastTwo = getLastTwoChapters(manhwa);
  const detailHref = `/manhwa/${manhwa.id}`;

  return (
    <div className='flex flex-row gap-4 items-stretch rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-3 transition-colors hover:border-zinc-700 hover:bg-zinc-900/70'>
      <Link
        href={detailHref}
        className='group relative h-[112px] w-[78px] shrink-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 active:scale-[0.98]'
      >
        <Image
          src={manhwa.coverImageUrl}
          alt={manhwa.title}
          fill
          className='object-cover transition-transform duration-300 group-hover:scale-105'
          sizes='78px'
          loading='lazy'
        />
        <div className='absolute top-1.5 left-1.5 flex items-center gap-0.5 rounded-full border border-zinc-800 bg-zinc-950/85 px-1.5 py-0.5 backdrop-blur-sm'>
          <Star className='h-2.5 w-2.5 fill-amber-400 text-amber-400' />
          <span className='text-[9px] font-bold text-zinc-50'>
            {manhwa.rating}
          </span>
        </div>
      </Link>

      <div className='flex min-w-0 flex-1 flex-col justify-center gap-2 py-0.5'>
        <Link href={detailHref} className='block active:opacity-90'>
          <h3 className='text-[15px] font-bold leading-snug text-zinc-100 line-clamp-2'>
            {manhwa.title}
          </h3>
        </Link>

        <div className='flex flex-col gap-0.5'>
          {lastTwo.length === 0 ? (
            <span className='text-xs text-zinc-600'>No chapters yet</span>
          ) : (
            lastTwo.map((ch) => (
              <Link
                key={ch.chapterNo}
                href={readerHref(manhwa.id, ch.chapterNo)}
                scroll={false}
                className='flex items-center gap-2 rounded-lg py-1.5 -mx-1 px-1 text-left transition-colors hover:bg-zinc-800/60 active:bg-zinc-800'
              >
                <BookMarked className='mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500/80' />
                <div className='min-w-0 flex-1'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className='text-[12px] font-black text-zinc-300'>
                      Ch. {ch.chapterNo}
                    </span>
                    {isChapterNewByPublishedAt(ch.publishedAt) ? (
                      <span className='rounded bg-cyan-500/15 px-1.5 py-px text-[9px] font-black uppercase tracking-wider text-cyan-400'>
                        New
                      </span>
                    ) : null}
                  </div>
                  {ch.title ? (
                    <p className='truncate text-[11px] font-medium text-zinc-500'>
                      {ch.title}
                    </p>
                  ) : null}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
