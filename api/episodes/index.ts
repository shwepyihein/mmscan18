import axios from "axios";
import { getBackendBaseUrl } from "@/lib/backend-base-url";

const API_URL = getBackendBaseUrl();

export interface Episode {
  id: string;
  manhwaId: string;
  number: number;
  title: string;
  pages: string[];
  isLocked: boolean;
  coinPrice: number;
}

export const getEpisodeById = async (id: string): Promise<Episode> => {
  const response = await axios.get(`${API_URL}/episodes/${id}`);
  return response.data;
};

export const unlockEpisode = async (id: string): Promise<{ success: boolean }> => {
  const response = await axios.post(`${API_URL}/episodes/${id}/unlock`);
  return response.data;
};
