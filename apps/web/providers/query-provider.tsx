"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ApiRequestError } from "@/lib/api/client";
import { isSessionLost } from "@/lib/api/errors";

const CURRENT_USER_KEY = ["auth", "me"];

function createQueryClient(): QueryClient {
  // Centralized recovery: when any request reveals the session is gone (and
  // the silent refresh already failed), mark the user signed out. The app
  // shell's guard then redirects to /auth/login.
  const onError = (error: unknown) => {
    if (isSessionLost(error)) client.setQueryData(CURRENT_USER_KEY, null);
  };

  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        // Client errors (401/404/422...) won't change on retry; network/5xx get one more try.
        retry: (failureCount, error) =>
          !(error instanceof ApiRequestError && error.status >= 400 && error.status < 500) &&
          failureCount < 1,
      },
    },
  });
  return client;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
