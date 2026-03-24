import { useRouter } from "next/router";
import { Navbar } from "./Navbar";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const router = useRouter();

  const hideNavbar = router.pathname.startsWith("/reader/");
  /** Reader keeps full width for vertical images; other pages get a centered column on desktop. */
  const readerFullBleed = router.pathname.startsWith("/reader/");

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <AnimatePresence mode="wait">
        <motion.main
          key={router.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn(
            "flex-grow pb-28 md:pb-24",
            readerFullBleed
              ? "w-full"
              : "mx-auto w-full max-w-5xl px-4 sm:px-6 lg:max-w-6xl lg:px-10",
          )}
        >
          {children}
        </motion.main>
      </AnimatePresence>

      {!hideNavbar && <Navbar />}
    </div>
  );
}
