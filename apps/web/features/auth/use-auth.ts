"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthUser } from "@task-time-tracker/shared";
import { ApiRequestError } from "@/lib/api/client";
import { authApi } from "./auth.api";

// The server session is the source of truth; this query cache is the only
// client-side copy of "who is logged in". There is no separate auth store.
const currentUserKey = ["auth", "me"] as const;

export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserKey,
    queryFn: async (): Promise<AuthUser | null> => {
      try {
        return (await authApi.me()).user;
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 401) return null;
        throw error;
      }
    },
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: ({ user }) => queryClient.setQueryData(currentUserKey, user),
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.register,
    onSuccess: ({ user }) => queryClient.setQueryData(currentUserKey, user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      queryClient.setQueryData(currentUserKey, null);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "auth" });
    },
  });
}
