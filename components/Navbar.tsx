import Link from "next/link";
import { useRouter } from "next/router";
import { Home, ShoppingBag, User, Search, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/useUserStore";
import { useAuth } from "@/components/AuthProvider";

const navItems = [
  { label: "Home", href: "/", icon: Home },
  { label: "Search", href: "/search", icon: Search },
  { label: "Shop", href: "/shop", icon: ShoppingBag },
  { label: "Profile", href: "/profile", icon: User },
];

export function Navbar() {
  const router = useRouter();
  const profile = useUserStore((state) => state.profile);
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <div className="fixed bottom-8 left-0 right-0 z-50 flex justify-center px-6 pointer-events-none">
      <nav className="flex items-center bg-zinc-900/90 backdrop-blur-2xl border border-zinc-800/50 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] pointer-events-auto px-2 py-2 gap-1">
        {/* Navigation Items */}
        {navItems.map((item) => {
          const isActive = router.pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center h-12 w-12 rounded-full transition-all duration-300",
                isActive ? "text-violet-400 bg-violet-500/10" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && "fill-current")} />
              {isActive && (
                <span className="absolute -bottom-1 w-1 h-1 bg-violet-500 rounded-full" />
              )}
            </Link>
          );
        })}

        {/* Vertical Divider */}
        <div className="w-px h-6 bg-zinc-800 mx-1" />

        {/* Coin Balance (Integrated Pill) */}
        <Link 
          href="/shop" 
          className="flex items-center gap-2 pl-2 pr-4 h-12 bg-amber-400/5 border border-amber-400/10 rounded-full active:scale-95 transition-transform"
        >
          <div className="w-8 h-8 rounded-full bg-amber-400/10 flex items-center justify-center">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <div className="flex flex-col -gap-1">
            <span className="text-[11px] font-black text-zinc-50 leading-none">
              {isLoading ? "…" : !isAuthenticated ? "—" : profile?.coins ?? 0}
            </span>
            <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest leading-none">
              Coins
            </span>
          </div>
        </Link>
      </nav>
    </div>
  );
}
