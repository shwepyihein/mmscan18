import Link from "next/link";
import { useRouter } from "next/router";
import {
  Home,
  LogIn,
  Search,
  ShoppingBag,
  Star,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/useUserStore";
import { useAuth } from "@/components/AuthProvider";

const navItems = [
  { label: "Home", href: "/", icon: Home },
  { label: "Search", href: "/search", icon: Search },
  { label: "Shop", href: "/shop", icon: ShoppingBag },
  { label: "Profile", href: "/profile", icon: User },
] as const;

export function Navbar() {
  const router = useRouter();
  const profile = useUserStore((state) => state.profile);
  const { isAuthenticated, isLoading } = useAuth();
  const loginHref =
    router.pathname === "/login"
      ? "/login"
      : `/login?next=${encodeURIComponent(router.asPath || "/")}`;
  const onLogin = router.pathname === "/login";

  const mainNavItems = navItems.filter(
    (item) => item.href !== "/profile" || isAuthenticated,
  );

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 md:px-6 md:pb-8">
      <nav
        aria-label="Main navigation"
        className="pointer-events-auto flex max-w-[min(100%,28rem)] items-center gap-0.5 overflow-x-auto rounded-full border border-zinc-800/60 bg-zinc-900/92 px-1.5 py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-2xl [scrollbar-width:none] md:max-w-none md:gap-1 md:px-2 md:py-2 [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex shrink-0 items-center gap-0.5 md:gap-1">
          {mainNavItems.map((item) => {
            const isActive = router.pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                title={item.label}
                className={cn(
                  "relative flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full transition-colors duration-200 md:h-12 md:w-12",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
                  isActive
                    ? "bg-violet-500/15 text-violet-400"
                    : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-200",
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] md:h-5 md:w-5",
                    isActive && "fill-current",
                  )}
                  aria-hidden
                />
                {isActive ? (
                  <span className="absolute bottom-1 h-0.5 w-4 rounded-full bg-violet-500 md:bottom-1.5" />
                ) : null}
              </Link>
            );
          })}
        </div>

        {!isLoading && !isAuthenticated ? (
          <div className="flex shrink-0 items-center border-l border-zinc-800/80 pl-0.5 md:pl-1">
            <Link
              href={loginHref}
              aria-label="Sign in"
              title="Sign in"
              aria-current={onLogin ? "page" : undefined}
              className={cn(
                "relative flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full transition-colors duration-200 md:h-12 md:w-12",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
                onLogin
                  ? "bg-violet-500/15 text-violet-400"
                  : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-200",
              )}
            >
              <LogIn
                className="h-[18px] w-[18px] md:h-5 md:w-5"
                aria-hidden
              />
              {onLogin ? (
                <span className="absolute bottom-1 h-0.5 w-4 rounded-full bg-violet-500 md:bottom-1.5" />
              ) : null}
            </Link>
          </div>
        ) : null}

        {isAuthenticated ? (
          <>
            <div
              className="mx-0.5 h-7 w-px shrink-0 bg-zinc-800 md:mx-1"
              aria-hidden
            />

            <Link
              href="/shop"
              aria-label="Coins balance, open shop"
              title={`${profile?.coinBalance ?? 0} coins — Shop`}
              className={cn(
                "flex h-11 shrink-0 items-center gap-2 rounded-full border border-amber-400/15 bg-amber-400/[0.07] pl-1.5 pr-3 transition-transform active:scale-[0.98] md:h-12 md:pl-2 md:pr-4",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400/12 md:h-9 md:w-9">
                <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500 md:h-4 md:w-4" />
              </div>
              <div className="flex min-w-[2.5rem] flex-col gap-0">
                <span className="text-[11px] font-black leading-none tabular-nums text-zinc-50 md:text-xs">
                  {isLoading ? "…" : (profile?.coinBalance ?? 0)}
                </span>
                <span className="text-[7px] font-black uppercase leading-none tracking-widest text-amber-500/95 md:text-[8px]">
                  Coins
                </span>
              </div>
            </Link>
          </>
        ) : null}
      </nav>
    </div>
  );
}
