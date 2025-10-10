export const DEFAULT_IMAGE = "https://placehold.co/400x300?text=Image+indisponible";
export  const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 jours

export  const setCache = (key, value, ttlMs) => {
  const record = { value, expiry: Date.now() + ttlMs };
  localStorage.setItem(key, JSON.stringify(record));
};

export  const getCache = (key) => {
  const record = localStorage.getItem(key);
  if (!record) return null;
  try {
    const parsed = JSON.parse(record);
    if (Date.now() > parsed.expiry) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
};