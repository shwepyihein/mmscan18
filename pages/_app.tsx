import "@/styles/globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { Layout } from "@/components/Layout";
import type { AppProps } from "next/app";
import {
  bindMiniAppCSSVars,
  bindThemeParamsCSSVars,
  bindViewportCSSVars,
  initMiniApp,
  initThemeParams,
  initViewport,
  isTMA,
} from "@telegram-apps/sdk";
import { useEffect } from "react";

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    let cancelled = false;
    isTMA().then((tma) => {
      if (!tma || cancelled) return;
      try {
        const [miniApp] = initMiniApp();
        const [themeParams] = initThemeParams();
        const [viewportPromise] = initViewport();
        viewportPromise.then((viewport) => {
          viewport.expand();
          bindViewportCSSVars(viewport);
        });
        bindMiniAppCSSVars(miniApp, themeParams);
        bindThemeParamsCSSVars(themeParams);
      } catch (error) {
        console.error("Failed to initialize Telegram SDK:", error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthProvider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </AuthProvider>
  );
}
