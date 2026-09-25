import { openUrl } from "@tauri-apps/plugin-opener";

/** Open a link in the system browser (Tauri) or a new tab (plain web dev server). */
export async function openExternal(url: string) {
  try {
    await openUrl(url);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

export const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
