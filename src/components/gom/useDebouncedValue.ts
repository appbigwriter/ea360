"use client";

import { useEffect, useState } from "react";

/**
 * Retorna `value` com atraso de `delayMs` desde a última mudança.
 * Usado para debounce da busca textual do GOM (AC2, ~300ms).
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
