import { useState, useEffect } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  getWalletMyRequests,
  type WalletMyRequest,
} from "@/api/wallet";
import {
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Star,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TransactionHistoryProps {
  trigger: React.ReactNode;
}

export function TransactionHistory({ trigger }: TransactionHistoryProps) {
  const [requests, setRequests] = useState<WalletMyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      let cancelled = false;
      setIsLoading(true);
      getWalletMyRequests()
        .then((data) => {
          if (!cancelled) {
            setRequests(data);
          }
        })
        .catch(() => {
          if (!cancelled) setRequests([]);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [open]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusIcon = (status: WalletMyRequest["status"]) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
      case "PENDING":
        return <Clock className="w-3.5 h-3.5 text-amber-500" />;
      case "FAILED":
        return <XCircle className="w-3.5 h-3.5 text-red-500" />;
    }
  };

  const priceLabel = (tx: WalletMyRequest) => {
    const parts = [tx.currency, tx.priceAmount].filter(Boolean);
    return parts.length ? parts.join(" · ") : null;
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent className="max-h-[85vh] border-zinc-900 bg-zinc-950">
        <div className="mx-auto my-4 h-1.5 w-12 flex-shrink-0 rounded-full bg-zinc-800" />
        <DrawerHeader className="px-6 text-left">
          <DrawerTitle className="text-xl font-black uppercase tracking-tight text-zinc-50">
            Transaction History
          </DrawerTitle>
          <DrawerDescription className="text-xs font-medium uppercase tracking-widest text-zinc-500">
            Coin purchase requests (wallet)
          </DrawerDescription>
        </DrawerHeader>

        <div className="min-h-[300px] overflow-y-auto px-6 pb-12">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                Loading…
              </p>
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-20 opacity-50">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 text-zinc-700">
                <Star className="h-8 w-8" />
              </div>
              <p className="text-sm font-bold text-zinc-500">
                No purchase requests yet
              </p>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              {requests.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-4 rounded-2xl border border-zinc-900/60 bg-zinc-900/40 p-4"
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      "bg-emerald-500/10 text-emerald-500",
                    )}
                  >
                    <ArrowDownLeft size={20} />
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="mb-0.5 flex items-center justify-between">
                      <h4 className="truncate text-sm font-black uppercase tracking-tight text-zinc-200">
                        Top-up request
                      </h4>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "text-base font-black tabular-nums text-emerald-400",
                          )}
                        >
                          +{tx.amountCoins}
                        </span>
                        <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                      </div>
                    </div>

                    {priceLabel(tx) ? (
                      <p className="mb-1 truncate text-[10px] font-medium text-zinc-500">
                        {priceLabel(tx)}
                      </p>
                    ) : null}

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                        {formatDate(tx.createdAt)}
                      </span>
                      <div className="flex items-center gap-1.5 rounded-full border border-zinc-900 bg-zinc-950/50 px-2 py-0.5">
                        {getStatusIcon(tx.status)}
                        <span
                          className={cn(
                            "text-[9px] font-black uppercase tracking-wider",
                            tx.status === "COMPLETED"
                              ? "text-emerald-500/80"
                              : tx.status === "PENDING"
                                ? "text-amber-500/80"
                                : "text-red-500/80",
                          )}
                        >
                          {tx.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
