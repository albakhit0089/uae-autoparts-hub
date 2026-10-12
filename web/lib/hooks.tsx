"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";
import type { User } from "./types";

/** Runs an async loader and re-runs it whenever data changes anywhere in the app. */
export function useData<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps);

  useEffect(() => {
    let alive = true;
    const go = () =>
      run()
        .then((d) => alive && (setData(d), setError(null)))
        .catch((e: Error) => alive && setError(e.message))
        .finally(() => alive && setLoading(false));
    go();
    window.addEventListener("uaeph:changed", go);
    return () => {
      alive = false;
      window.removeEventListener("uaeph:changed", go);
    };
  }, [run]);

  return { data, error, loading };
}

interface AuthCtx {
  user: User | null;
  ready: boolean;
  refresh: () => Promise<void>;
}

const Auth = createContext<AuthCtx>({ user: null, ready: false, refresh: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setUser(await api.currentUser());
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener("uaeph:changed", refresh);
    return () => window.removeEventListener("uaeph:changed", refresh);
  }, [refresh]);
  return <Auth.Provider value={{ user, ready, refresh }}>{children}</Auth.Provider>;
}

export const useAuth = () => useContext(Auth);

type Theme = "light" | "dark";
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "light", toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    let initial: Theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    try {
      const saved = localStorage.getItem("uaeph-theme");
      if (saved === "dark" || saved === "light") initial = saved;
    } catch {
      /* ignore */
    }
    setTheme(initial);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  const toggle = () =>
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("uaeph-theme", next);
      } catch {
        /* ignore */
      }
      return next;
    });
  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);

/** Tiny toast system. */
const ToastCtx = createContext<(msg: string, kind?: "ok" | "err") => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: "ok" | "err" }[]>([]);
  const push = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg animate-in ${t.kind === "err" ? "bg-red-600 text-white" : "bg-navy-900 text-white dark:bg-white dark:text-navy-900"}`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
