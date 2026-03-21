import Head from "next/head";
import { Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Search() {
  return (
    <>
      <Head>
        <title>Search | hotManhwammhub</title>
      </Head>
      <div className="p-4 flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-zinc-50 flex items-center gap-2">
            <SearchIcon className="text-violet-500" />
            Find Manhwa
          </h1>
          <p className="text-zinc-500 text-sm">
            Search through our extensive library.
          </p>
        </header>

        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
          <Input 
            placeholder="Search titles, authors, genres..." 
            className="pl-10 bg-zinc-900 border-zinc-800 focus:ring-violet-600 h-12"
          />
        </div>

        <div className="flex flex-col gap-4 mt-4">
          <h2 className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Popular Genres</h2>
          <div className="flex flex-wrap gap-2">
            {["Action", "Romance", "Fantasy", "Drama", "Shonen", "Isekai"].map((genre) => (
              <span 
                key={genre}
                className="px-4 py-2 bg-zinc-900 rounded-full text-zinc-300 text-sm border border-zinc-800 hover:border-violet-600/50 hover:text-violet-400 transition-colors cursor-pointer"
              >
                {genre}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
