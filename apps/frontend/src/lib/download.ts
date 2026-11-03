import { api } from "@/api/client";

/**
 * Downloads need the bearer token, so a plain `<a href>` cannot be used (§11.5).
 * Fetch the blob, click a temporary link, revoke the object URL.
 */
export const downloadFile = async (path: string, filename: string): Promise<void> => {
  const blob = await api.blob(path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

/** Last-used engagement, wrapped in try/catch because storage can throw. */
const LAST_ENGAGEMENT_KEY = "finsight:last-engagement";

export const readLastEngagement = (): string | null => {
  try {
    return window.localStorage.getItem(LAST_ENGAGEMENT_KEY);
  } catch {
    return null;
  }
};

export const writeLastEngagement = (id: string): void => {
  try {
    window.localStorage.setItem(LAST_ENGAGEMENT_KEY, id);
  } catch {
    // Private mode / storage disabled: not important enough to surface.
  }
};
