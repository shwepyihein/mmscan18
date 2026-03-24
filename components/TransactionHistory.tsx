import { useState, useEffect } from "react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { getUserTransactions, type UserTransaction } from "@/api/users";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Star,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TransactionHistoryProps {
  trigger: React.ReactNode;
}

export function TransactionHistory({ trigger }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<UserTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      let cancelled = false;
      setIsLoading(true);
      getUserTransactions()
        .then((data) => {
          if (!cancelled) {
            setTransactions(data);
          }
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
      return () => { cancelled = true; };
    }
  }, [open]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getStatusIcon = (status: UserTransaction['status']) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
      case 'PENDING': return <Clock className="w-3.5 h-3.5 text-amber-500" />;
      case 'FAILED': return <XCircle className="w-3.5 h-3.5 text-red-500" />;
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {trigger}
      </DrawerTrigger>
      <DrawerContent className="bg-zinc-950 border-zinc-900 max-h-[85vh]">
        <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-800 my-4" />
        <DrawerHeader className="text-left px-6">
          <DrawerTitle className="text-xl font-black text-zinc-50 uppercase tracking-tight">
            Transaction History
          </DrawerTitle>
          <DrawerDescription className="text-zinc-500 text-xs font-medium uppercase tracking-widest">
            Your recent coin activity
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-6 pb-12 overflow-y-auto min-h-[300px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Fetching History...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
              <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-700">
                <Star className="w-8 h-8" />
              </div>
              <p className="text-sm font-bold text-zinc-500">No transactions yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 mt-4">
              {transactions.map((tx) => (
                <div 
                  key={tx.id} 
                  className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/40 border border-zinc-900/60"
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    tx.type === 'TOPUP' ? "bg-emerald-500/10 text-emerald-500" : "bg-violet-500/10 text-violet-500"
                  )}>
                    {tx.type === 'TOPUP' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                  </div>
                  
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4 className="text-sm font-black text-zinc-200 uppercase tracking-tight truncate">
                        {tx.type === 'TOPUP' ? 'Coin Top-up' : 'Chapter Unlock'}
                      </h4>
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "text-base font-black tabular-nums",
                          tx.type === 'TOPUP' ? "text-emerald-400" : "text-zinc-50"
                        )}>
                          {tx.type === 'TOPUP' ? '+' : '-'}{tx.amount}
                        </span>
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                        {formatDate(tx.createdAt)}
                      </span>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-950/50 border border-zinc-900">
                        {getStatusIcon(tx.status)}
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-wider",
                          tx.status === 'COMPLETED' ? "text-emerald-500/80" : 
                          tx.status === 'PENDING' ? "text-amber-500/80" : "text-red-500/80"
                        )}>
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
