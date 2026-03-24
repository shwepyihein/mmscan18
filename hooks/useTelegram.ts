import { useEffect, useState } from "react";
import { initInitData, retrieveLaunchParams, type User } from "@telegram-apps/sdk";

export const useTelegram = () => {
  const [user, setUser] = useState<User | undefined>(undefined);
  const [initDataRaw, setInitDataRaw] = useState<string | undefined>(undefined);

  useEffect(() => {
    try {
      const initData = initInitData();
      if (initData && initData.user) {
        setUser(initData.user);
      }
      
      const launchParams = retrieveLaunchParams();
      if (launchParams && launchParams.initDataRaw) {
        setInitDataRaw(launchParams.initDataRaw);
      }
    } catch (e) {
      console.error("Telegram InitData not available", e);
    }
  }, []);

  return {
    user,
    initDataRaw,
  };
};
