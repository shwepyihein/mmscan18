import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { ShoppingBag, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PaymentDialog } from "@/components/PaymentDialog";
import { useUserStore } from "@/store/useUserStore";
import { cn } from "@/lib/utils";
import {
  formatCoinPackageAmount,
  getCoinPackages,
  type PaymentPackage,
} from "@/api/payments";

const SHOP_CURRENCIES = ["MMK", "THB"] as const;

export default function Shop() {
  const [coinPackages, setCoinPackages] = useState<PaymentPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currencyFilter, setCurrencyFilter] = useState<(typeof SHOP_CURRENCIES)[number]>("MMK");
  const [selectedPackage, setSelectedPackage] = useState<PaymentPackage | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const profile = useUserStore((state) => state.profile);

  const filteredPackages = useMemo(
    () => coinPackages.filter((p) => p.currency === currencyFilter),
    [coinPackages, currencyFilter],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setFetchError(null);
        const data = await getCoinPackages();
        if (!cancelled) setCoinPackages(data);
      } catch {
        if (!cancelled) setFetchError("Could not load packages. Try again later.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading || coinPackages.length === 0) return;
    const hasForFilter = coinPackages.some((p) => p.currency === currencyFilter);
    if (!hasForFilter) {
      const next = coinPackages.some((p) => p.currency === "MMK") ? "MMK" : "THB";
      setCurrencyFilter(next);
    }
  }, [loading, coinPackages, currencyFilter]);

  const handleBuy = (pkg: PaymentPackage) => {
    setSelectedPackage(pkg);
    setIsDialogOpen(true);
  };

  return (
    <>
      <Head>
        <title>Shop | hotManhwammhub</title>
      </Head>
      <div className="p-4 flex flex-col gap-6">
        <header className="flex flex-col gap-2 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-black text-zinc-50 uppercase tracking-tight flex items-center gap-2">
              <ShoppingBag className="text-violet-500 w-8 h-8" />
              Store
            </h1>
            <div className="flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 px-3 py-1.5 rounded-full">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span className="text-sm font-black text-amber-500">{profile?.coins || 0}</span>
            </div>
          </div>
          <p className="text-zinc-500 text-sm font-medium">
            Get coins to unlock your favorite chapters instantly.
          </p>
        </header>

        {fetchError && (
          <p className="text-sm font-medium text-red-400/90 text-center py-2">{fetchError}</p>
        )}

        {!loading && coinPackages.length > 0 && (
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Price currency">
            {SHOP_CURRENCIES.map((code) => (
              <button
                key={code}
                type="button"
                role="tab"
                aria-selected={currencyFilter === code}
                onClick={() => setCurrencyFilter(code)}
                className={cn(
                  "rounded-full border px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors",
                  currencyFilter === code
                    ? code === "MMK"
                      ? "border-amber-400/60 bg-amber-500/15 text-amber-400 shadow-sm shadow-amber-950/30"
                      : "border-violet-400/60 bg-violet-500/15 text-violet-300 shadow-sm shadow-violet-950/30"
                    : "border-zinc-700/90 bg-zinc-900/50 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400",
                )}
              >
                {code}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card
                  key={i}
                  className="bg-zinc-900 border-zinc-800 rounded-2xl overflow-hidden shadow-xl shadow-zinc-950/50 animate-pulse"
                >
                  <CardHeader className="p-5 pb-2 items-center text-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-zinc-800" />
                    <div className="h-6 w-24 bg-zinc-800 rounded-md" />
                    <div className="h-3 w-20 bg-zinc-800 rounded-md" />
                  </CardHeader>
                  <CardContent className="p-5 pt-2">
                    <div className="h-10 w-full bg-zinc-800 rounded-xl" />
                  </CardContent>
                </Card>
              ))
            : coinPackages.length === 0
              ? (
                  <p className="col-span-2 text-center text-sm text-zinc-500 font-medium py-8">
                    No packages available right now.
                  </p>
                )
              : filteredPackages.length === 0
                ? (
                    <p className="col-span-2 text-center text-sm text-zinc-500 font-medium py-8">
                      No packages in {currencyFilter} right now.
                    </p>
                  )
                : filteredPackages.map((pkg) => (
                <Card
                  key={`${pkg.id}-${pkg.currency}`}
                  className="bg-zinc-900 border-zinc-800 rounded-2xl overflow-hidden shadow-xl shadow-zinc-950/50"
                >
                  <CardHeader className="p-5 pb-2 items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-amber-400/10 flex items-center justify-center mb-2">
                      <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
                    </div>
                    <CardTitle className="text-zinc-50 text-xl font-black uppercase tracking-tight">
                      {pkg.coins} <span className="text-amber-400">Coins</span>
                    </CardTitle>
                    <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
                      <span className="inline-flex items-center rounded-lg border border-zinc-700/80 bg-zinc-800/60 px-2.5 py-1 text-[11px] font-bold tabular-nums text-zinc-100">
                        {formatCoinPackageAmount(pkg)}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest",
                          pkg.currency === "THB"
                            ? "border-violet-500/45 bg-violet-500/10 text-violet-300"
                            : "border-amber-500/45 bg-amber-500/10 text-amber-200",
                        )}
                      >
                        {pkg.currency}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 pt-2">
                    <Button
                      onClick={() => handleBuy(pkg)}
                      className="w-full bg-violet-600 hover:bg-violet-700 text-zinc-50 text-xs font-black h-10 rounded-xl uppercase tracking-widest"
                    >
                      Buy Now
                    </Button>
                  </CardContent>
                </Card>
              ))
          }
        </div>

        <div className="mt-4 p-5 bg-zinc-900/30 border border-zinc-900 rounded-2xl">
          <h3 className="text-sm font-black text-zinc-300 uppercase tracking-widest mb-2">How it works?</h3>
          <ol className="flex flex-col gap-3">
            {[
              "Pick a package that suits you.",
              "Send payment to our QR or phone number.",
              "Upload screenshot for verification.",
              "Wait 5-30 mins for coins to be added."
            ].map((text, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-500">
                  {i + 1}
                </span>
                <p className="text-xs text-zinc-500 font-medium leading-tight">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <PaymentDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        packageData={
          selectedPackage
            ? {
                id: selectedPackage.id,
                coins: selectedPackage.coins,
                priceAmount: formatCoinPackageAmount(selectedPackage),
                currency: selectedPackage.currency,
              }
            : null
        }
      />
    </>
  );
}
