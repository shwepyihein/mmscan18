import { useRouter } from "next/router";
import { Navbar } from "./Navbar";
import { motion, AnimatePresence } from "framer-motion";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const router = useRouter();
  
  // Hide Navbar in the reader page
  const hideNavbar = router.pathname.startsWith("/reader/");

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <AnimatePresence mode="wait">
        <motion.main
          key={router.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex-grow pb-32" // Increased padding for floating navbar
        >
          {children}
        </motion.main>
      </AnimatePresence>

      {!hideNavbar && <Navbar />}
    </div>
  );
}
