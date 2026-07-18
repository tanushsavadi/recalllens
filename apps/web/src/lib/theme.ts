import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "dark" | "light";

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

function apply(theme: Theme) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      setTheme: (t) => {
        apply(t);
        set({ theme: t });
      },
      toggle: () => {
        const next = get().theme === "dark" ? "light" : "dark";
        apply(next);
        set({ theme: next });
      },
    }),
    {
      name: "recalllens-theme",
      onRehydrateStorage: () => (state) => {
        apply(state?.theme ?? "dark");
      },
    },
  ),
);

// Apply immediately on module load so there's no flash before React mounts.
apply(
  (typeof localStorage !== "undefined" &&
    (() => {
      try {
        return JSON.parse(localStorage.getItem("recalllens-theme") ?? "{}")
          ?.state?.theme as Theme;
      } catch {
        return undefined;
      }
    })()) || "dark",
);
