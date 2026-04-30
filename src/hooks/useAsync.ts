import { useEffect, useState } from 'react';

interface UseAsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

interface UseAsyncOptions {
  /**
   * Interval in milliseconds for polling. If undefined, no polling.
   */
  interval?: number;
  /**
   * Initial delay before first execution in milliseconds.
   */
  initialDelay?: number;
}

/**
 * Generic hook for async operations with optional polling.
 *
 * @param fn - Async function to execute
 * @param options - Configuration options
 * @param deps - Dependency array to trigger re-execution
 * @returns Object with data, loading, and error states
 *
 * @example
 * ```tsx
 * const { data: status } = useAsync(
 *   () => dashboardApi.fetchThermalStatus(),
 *   { interval: 3000 }
 * );
 * ```
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  options: UseAsyncOptions = {},
  deps: unknown[] = []
): UseAsyncState<T> {
  const [state, setState] = useState<UseAsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const execute = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const result = await fn();
        if (!disposed) {
          setState({ data: result, loading: false, error: null });
        }
      } catch (err) {
        if (!disposed) {
          const error = err instanceof Error ? err : new Error(String(err));
          setState({ data: null, loading: false, error });
        }
      }
    };

    const init = async () => {
      if (options.initialDelay && options.initialDelay > 0) {
        timer = setTimeout(() => {
          if (!disposed) void execute();
        }, options.initialDelay);
      } else {
        void execute();
      }

      if (options.interval && options.interval > 0) {
        intervalId = setInterval(() => {
          if (!disposed) void execute();
        }, options.interval);
      }
    };

    void init();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      if (intervalId) clearInterval(intervalId);
    };
  }, deps);

  return state;
}
