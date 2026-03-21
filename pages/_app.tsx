import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useEffect } from "react";
import { 
  initMiniApp, 
  initViewport, 
  initThemeParams, 
  bindMiniAppCSSVars,
  bindThemeParamsCSSVars,
  bindViewportCSSVars
} from "@telegram-apps/sdk";
import { Layout } from "@/components/Layout";

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    try {
      // Initialize components
      const [miniApp] = initMiniApp();
      const [themeParams] = initThemeParams();
      
      // Initialize viewport (async)
      const [viewportPromise] = initViewport();
      viewportPromise.then((viewport) => {
        viewport.expand();
        bindViewportCSSVars(viewport);
      });

      // Bind CSS variables
      bindMiniAppCSSVars(miniApp, themeParams);
      bindThemeParamsCSSVars(themeParams);

      console.log("Telegram SDK initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Telegram SDK:", error);
    }
  }, []);

  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}
