import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/** GET /public/latest — latest published chapters */
export const getPublicLatest = async (): Promise<unknown> => {
  const { data } = await axios.get(`${API_URL}/public/latest`);
  return data;
};

/** GET /public/popular — popular chapters */
export const getPublicPopularChapters = async (): Promise<unknown> => {
  const { data } = await axios.get(`${API_URL}/public/popular`);
  return data;
};

/** GET /public/popular-manhwa — popular manhwa */
export const getPublicPopularManhwa = async (): Promise<unknown> => {
  const { data } = await axios.get(`${API_URL}/public/popular-manhwa`);
  return data;
};

/** GET /public/search — search (pass query params as needed by backend, e.g. q) */
export const getPublicSearch = async (
  params?: Record<string, string | number | boolean | undefined>,
): Promise<unknown> => {
  const { data } = await axios.get(`${API_URL}/public/search`, { params });
  return data;
};
