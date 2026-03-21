import Head from "next/head";
import { User, Wallet, History, LogOut, Star, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useUserStore } from "@/store/useUserStore";
import { useRouter } from "next/router";

export default function Profile() {
  const router = useRouter();
  const profile = useUserStore((state) => state.profile);

  return (
    <>
      <Head>
        <title>Account | hotManhwammhub</title>
      </Head>
      <div className="p-4 flex flex-col gap-6">
        <header className="flex items-center justify-between p-2">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-3xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-500 shadow-lg shadow-violet-900/10">
              <User size={32} />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-black text-zinc-50 uppercase tracking-tight">
                {profile?.username || "Guest User"}
              </h1>
              <p className="text-zinc-500 text-[11px] font-bold uppercase tracking-widest">
                ID: {profile?.id || "---"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="text-zinc-600">
            <Settings size={20} />
          </Button>
        </header>

        <Card className="bg-zinc-900 border-zinc-800 rounded-3xl overflow-hidden shadow-2xl shadow-zinc-950/50">
          <CardContent className="p-8 flex flex-col items-center justify-center gap-1 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
               <Star size={120} className="text-amber-400 fill-amber-400" />
            </div>
            
            <span className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Available Balance</span>
            <div className="flex items-center gap-3">
              <span className="text-5xl font-black text-zinc-50 tracking-tighter">
                {profile?.coins || 0}
              </span>
              <div className="flex flex-col">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500 mb-0.5" />
                <span className="text-[10px] font-black text-amber-500 uppercase">Coins</span>
              </div>
            </div>
            
            <Button 
              onClick={() => router.push("/shop")}
              className="mt-8 w-full bg-zinc-50 hover:bg-zinc-200 text-zinc-950 h-12 text-xs font-black rounded-xl uppercase tracking-[0.15em]"
            >
              Top Up Now
            </Button>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2 mt-2">
          <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] px-2 mb-2">History & Activity</h3>
          <Button variant="ghost" className="justify-start gap-4 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-900 h-14 rounded-2xl px-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center">
               <Wallet size={18} />
            </div>
            <span className="text-sm font-bold">Transaction History</span>
          </Button>
          <Button variant="ghost" className="justify-start gap-4 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-900 h-14 rounded-2xl px-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center">
               <History size={18} />
            </div>
            <span className="text-sm font-bold">Recently Read</span>
          </Button>
          
          <div className="h-px bg-zinc-900 my-4" />
          
          <Button variant="ghost" className="justify-start gap-4 text-red-500/60 hover:text-red-400 hover:bg-red-500/5 h-14 rounded-2xl px-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/5 flex items-center justify-center">
               <LogOut size={18} />
            </div>
            <span className="text-sm font-bold">Logout Session</span>
          </Button>
        </div>
      </div>
    </>
  );
}
