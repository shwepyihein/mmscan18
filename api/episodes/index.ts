import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

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
