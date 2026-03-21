import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Upload, CheckCircle2, QrCode } from "lucide-react";
import Image from "next/image";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageData: {
    coins: number;
    priceAmount: string;
    currency: string;
  } | null;
}

export function PaymentDialog({ open, onOpenChange, packageData }: PaymentDialogProps) {
  const [step, setStep] = useState<"instructions" | "upload" | "success">("instructions");
  const [file, setFile] = useState<File | null>(null);

  const handleNext = () => setStep("upload");
  
  const handleSubmit = () => {
    setStep("success");
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after a delay
    setTimeout(() => {
      setStep("instructions");
      setFile(null);
    }, 300);
  };

  if (!packageData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-900 w-[90%] rounded-3xl p-6 gap-6 max-w-sm">
        {step === "instructions" && (
          <>
            <DialogHeader className="items-center text-center">
              <DialogTitle className="text-xl font-black text-zinc-50 uppercase tracking-tight">
                Payment Details
              </DialogTitle>
              <DialogDescription className="text-zinc-500 font-medium text-xs">
                Send{" "}
                <span className="inline-flex flex-wrap items-center gap-1 align-middle">
                  <span className="inline-flex items-center rounded-md border border-zinc-700 bg-zinc-800/80 px-2 py-0.5 text-[11px] font-bold tabular-nums text-zinc-100">
                    {packageData.priceAmount}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
                      packageData.currency === "THB"
                        ? "border-violet-500/45 bg-violet-500/10 text-violet-300"
                        : "border-amber-500/45 bg-amber-500/10 text-amber-200",
                    )}
                  >
                    {packageData.currency}
                  </span>
                </span>{" "}
                to the following account.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="bg-zinc-900/50 border border-zinc-900 rounded-2xl p-4 flex flex-col items-center gap-3">
                <div className="relative w-32 h-32 bg-white rounded-xl p-2">
                  <QrCode className="w-full h-full text-zinc-950" />
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">KBZPay / WaveMoney</span>
                  <span className="text-lg font-black text-zinc-100">09 777 888 999</span>
                  <span className="text-xs font-bold text-zinc-500">U SHWE PYI HEIN</span>
                </div>
              </div>

              <div className="p-4 bg-amber-400/5 border border-amber-400/10 rounded-xl">
                <p className="text-[11px] text-amber-500 leading-relaxed font-medium">
                  ⚠️ Please include your Telegram ID in the payment note to speed up the process.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button 
                onClick={handleNext}
                className="w-full bg-violet-600 hover:bg-violet-700 h-12 text-sm font-black rounded-xl uppercase tracking-widest shadow-lg shadow-violet-900/20"
              >
                I've Paid
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "upload" && (
          <>
            <DialogHeader className="items-center text-center">
              <DialogTitle className="text-xl font-black text-zinc-50 uppercase tracking-tight">
                Verify Payment
              </DialogTitle>
              <DialogDescription className="text-zinc-500 font-medium text-xs">
                Upload your transaction screenshot.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div 
                className={`relative aspect-[3/4] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${file ? 'border-violet-500 bg-violet-500/5' : 'border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50'}`}
                onClick={() => document.getElementById('screenshot-upload')?.click()}
              >
                {file ? (
                  <div className="absolute inset-0 p-2">
                    <img src={URL.createObjectURL(file)} alt="Screenshot preview" className="w-full h-full object-contain rounded-xl" />
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-500">
                      <Upload className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-zinc-600">Select Image</span>
                  </>
                )}
              </div>
              <input 
                id="screenshot-upload"
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>

            <DialogFooter className="gap-3">
              <Button 
                variant="ghost" 
                onClick={() => setStep("instructions")}
                className="h-12 text-zinc-500 font-bold uppercase tracking-widest text-[11px]"
              >
                Back
              </Button>
              <Button 
                disabled={!file}
                onClick={handleSubmit}
                className="flex-grow bg-violet-600 hover:bg-violet-700 h-12 text-sm font-black rounded-xl uppercase tracking-widest shadow-lg shadow-violet-900/20"
              >
                Submit
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "success" && (
          <div className="py-8 flex flex-col items-center text-center gap-6">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-black text-zinc-50 uppercase tracking-tight">Request Sent!</h2>
              <p className="text-xs text-zinc-500 font-medium leading-relaxed px-4">
                Our admin will verify your payment and add <span className="text-amber-400 font-bold">{packageData.coins} Coins</span> to your account within 30 minutes.
              </p>
            </div>
            <Button 
              onClick={handleClose}
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 h-12 text-xs font-black rounded-xl uppercase tracking-widest border border-zinc-800"
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
