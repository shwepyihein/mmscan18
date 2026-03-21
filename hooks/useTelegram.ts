import { useEffect, useState } from "react";
import { initInitData, type User } from "@telegram-apps/sdk";

export const useTelegram = () => {
  const [user, setUser] = useState<User | undefined>(undefined);
  const [initDataRaw, setInitDataRaw] = useState<string | undefined>(undefined);

  useEffect(() => {
    try {
      const initData = initInitData();
      if (initData && initData.user) {
        setUser(initData.user);
      }
      if (initData && initData.authDate) { // Just to check if data exists
         // The SDK usually has a way to get raw data or we get it from launch params
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
