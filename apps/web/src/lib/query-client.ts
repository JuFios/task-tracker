import { QueryClient } from '@tanstack/react-query';

function hasStatus(error: unknown, from: number, to: number): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return typeof status === 'number' && status >= from && status < to;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (hasStatus(error, 400, 500)) return false;
        return failureCount < 2;
      },
    },
  },
});
