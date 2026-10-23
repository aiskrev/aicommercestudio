"use client";

import { useCallback, useEffect, useState } from "react";

import { adminDictionaries } from "@/i18n/admin";
import { adminClientLocale, adminFetch, ApiError } from "@/lib/admin-api";

interface State<T> {
  path: string | null;
  data?: T;
  error?: string;
  errorId?: string | null;
  version: number;
}

/** Fetches admin API data for `path`; re-fetches when the path changes or `reload()` is called. */
export function useAdminData<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<State<T>>({ path: null, version: -1 });

  useEffect(() => {
    if (!path) return;
    let active = true;
    adminFetch<T>(path).then(
      (data) => active && setState({ path, data, version }),
      (error: unknown) =>
        active &&
        setState((current) => ({
          path,
          data: current.data,
          version,
          error: error instanceof ApiError ? error.message : adminDictionaries[adminClientLocale()].common.unexpected,
          errorId: error instanceof ApiError ? error.requestId : null,
        })),
    );
    return () => {
      active = false;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const replace = useCallback((data: T) => setState((current) => ({ ...current, data, error: undefined })), []);

  const loading = state.path !== path || state.version !== version;
  return {
    data: state.data,
    error: loading ? undefined : state.error,
    errorId: loading ? undefined : state.errorId,
    loading,
    reload,
    replace,
  };
}
