import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface UserProfile {
  id: string;
  telegramId: string;
  username?: string;
  coins: number;
}

export const getProfile = async (): Promise<UserProfile> => {
  const response = await axios.get(`${API_URL}/users/profile`);
  return response.data;
};

export const syncTelegramUser = async (initData: string): Promise<UserProfile> => {
  const response = await axios.post(`${API_URL}/users/sync`, { initData });
  return response.data;
};
