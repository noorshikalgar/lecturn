import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { describeError, toast } from "./toast";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
  // A blanket net for every query/mutation in the app: without this, a
  // failed fetch just leaves whatever empty/stale state was already on
  // screen with no signal anything went wrong. A screen that wants a more
  // specific inline error (e.g. a bad :id) can still render one — this only
  // adds a toast, it doesn't replace per-query handling.
  queryCache: new QueryCache({
    onError: (err, query) => {
      if (query.meta?.silent) return;
      toast.error(describeError(err));
    },
  }),
  mutationCache: new MutationCache({
    onError: (err, _vars, _ctx, mutation) => {
      if (mutation.meta?.silent) return;
      toast.error(describeError(err));
    },
  }),
});
