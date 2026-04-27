/**
 * Matches backend chapter reader response:
 * { chapter, images, mmJson, enJson, prevChapterNo, nextChapterNo, ... }
 */

export interface ChapterReadTextSettings {
  fontSize?: string | number;
  fontFamily?: string;
  textAlign?: string;
  /** API / reader */
  fontColor?: string;
  /** ImageCleaner-style alias */
  color?: string;
  lineHeight?: string | number;
  fontWeight?: string;
}

/** One text region; `box` is [x, y, width, height] in natural image pixels (same as ImageCleanerWorkspace). */
export interface MmJsonOverlayBlock {
  text: string;
  box?: [number, number, number, number];
  settings?: ChapterReadTextSettings;
}

export interface ChapterReadTextBlock {
  box?: number[];
  text?: string;
  settings?: ChapterReadTextSettings;
}

export interface ChapterReadMmJsonPage {
  image?: string;
  texts?: ChapterReadTextBlock[];
}

export interface ChapterReadManhwa {
  id?: string;
  title?: string;
  totalChapters?: number;
  slugUrl?: string;
}

export interface ChapterReadChapter {
  id?: string;
  manhwaId?: string;
  manhwa?: ChapterReadManhwa;
  chapterNo?: number;
  title?: string;
  isLocked?: boolean;
  coinPrice?: number;
}

export interface ChapterReadResponse {
  chapter?: ChapterReadChapter;
  images?: string[];
  mmJson?: ChapterReadMmJsonPage[];
  enJson?: ChapterReadMmJsonPage[];
  nextChapterNo?: number | null;
  prevChapterNo?: number | null;
  nextChapterId?: string | null;
  prevChapterId?: string | null;
}
