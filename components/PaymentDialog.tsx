import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Upload,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Download,
} from "lucide-react";
import {
  priceAmountForPurchaseRequest,
  submitPaymentRequest,
} from "@/api/payments";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageData: {
    id: string;
    coins: number;
    /** Raw catalog price for API. */
    price: number;
    /** Locale-formatted for display. */
    priceAmount: string;
    currency: string;
  } | null;
}

type MmPaymentMethod = "aya" | "kpay";

const BANK_ASSETS = {
  thaiKbank: { href: "/bank/thaiKbank.png", filename: "thai-kbank-payment.png" },
  ayaPay: { href: "/bank/AYAPAYmm.jpeg", filename: "aya-pay-payment.jpg" },
  kpay: { href: "/bank/KPAYmm.jpeg", filename: "kpay-payment.jpg" },
} as const;

function PaymentQrDownload({
  href,
  downloadName,
}: {
  href: string;
  downloadName: string;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 border-zinc-700 bg-zinc-900/50 text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
      asChild
    >
      <a href={href} download={downloadName}>
        <Download className="mr-1.5 h-3.5 w-3.5" />
        Download QR
      </a>
    </Button>
  );
}

export function PaymentDialog({ open, onOpenChange, packageData }: PaymentDialogProps) {
  const [step, setStep] = useState<"instructions" | "upload" | "success">("instructions");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mmPaymentTab, setMmPaymentTab] = useState<MmPaymentMethod>("aya");

  useEffect(() => {
    if (open) setMmPaymentTab("aya");
  }, [open, packageData?.id]);

  const handleNext = () => setStep("upload");
  
  const handleSubmit = async () => {
    if (!packageData || !file) return;
    
    setIsSubmitting(true);
    setError(null);
    try {
      await submitPaymentRequest({
        coinPackageId: packageData.id,
        currency: packageData.currency,
        priceAmount: priceAmountForPurchaseRequest({
          price: packageData.price,
        }),
        invoice: file,
      });
      setStep("success");
    } catch (err) {
      setError("Failed to submit request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after a delay
    setTimeout(() => {
      setStep("instructions");
      setFile(null);
      setError(null);
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
                {packageData.currency === "THB" ? (
                  <div className="flex w-full flex-col items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/bank/thaiKbank.png"
                      alt="Thai KBank payment QR"
                      className="h-auto w-full max-h-56 rounded-lg object-contain"
                    />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                      Thai KBank
                    </span>
                    <PaymentQrDownload
                      href={BANK_ASSETS.thaiKbank.href}
                      downloadName={BANK_ASSETS.thaiKbank.filename}
                    />
                  </div>
                ) : (
                  <Tabs
                    value={mmPaymentTab}
                    onValueChange={(v) => setMmPaymentTab(v as MmPaymentMethod)}
                    className="w-full"
                  >
                    <TabsList className="grid h-10 w-full grid-cols-2 gap-0 rounded-lg border border-zinc-800 bg-zinc-900/90 p-1">
                      <TabsTrigger
                        value="aya"
                        className={cn(
                          "rounded-md text-[10px] font-black uppercase tracking-widest text-zinc-500",
                          "data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200 data-[state=active]:shadow-none",
                        )}
                      >
                        AYA Pay
                      </TabsTrigger>
                      <TabsTrigger
                        value="kpay"
                        className={cn(
                          "rounded-md text-[10px] font-black uppercase tracking-widest text-zinc-500",
                          "data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200 data-[state=active]:shadow-none",
                        )}
                      >
                        KPay
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="aya" className="mt-3 flex flex-col items-center gap-2 outline-none">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/bank/AYAPAYmm.jpeg"
                        alt="AYA Pay payment QR"
                        className="h-auto w-full max-h-52 rounded-lg object-contain"
                      />
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Scan with AYA Pay
                      </span>
                      <PaymentQrDownload
                        href={BANK_ASSETS.ayaPay.href}
                        downloadName={BANK_ASSETS.ayaPay.filename}
                      />
                    </TabsContent>
                    <TabsContent value="kpay" className="mt-3 flex flex-col items-center gap-2 outline-none">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/bank/KPAYmm.jpeg"
                        alt="KPay payment QR"
                        className="h-auto w-full max-h-52 rounded-lg object-contain"
                      />
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Scan with KPay
                      </span>
                      <PaymentQrDownload
                        href={BANK_ASSETS.kpay.href}
                        downloadName={BANK_ASSETS.kpay.filename}
                      />
                    </TabsContent>
                  </Tabs>
                )}
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
                I&apos;ve Paid
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
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-[10px] font-bold uppercase tracking-wider">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
              <div 
                className={cn(
                  "relative aspect-[3/4] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors",
                  file ? 'border-violet-500 bg-violet-500/5' : 'border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50',
                  isSubmitting && "opacity-50 pointer-events-none"
                )}
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
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setError(null);
                }}
              />
            </div>

            <DialogFooter className="gap-3">
              <Button 
                variant="ghost" 
                onClick={() => setStep("instructions")}
                disabled={isSubmitting}
                className="h-12 text-zinc-500 font-bold uppercase tracking-widest text-[11px]"
              >
                Back
              </Button>
              <Button 
                disabled={!file || isSubmitting}
                onClick={handleSubmit}
                className="flex-grow bg-violet-600 hover:bg-violet-700 h-12 text-sm font-black rounded-xl uppercase tracking-widest shadow-lg shadow-violet-900/20"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit"}
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
