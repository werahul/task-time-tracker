import type { AuthUser, LoginInput, RegisterInput } from "@task-time-tracker/shared";
import { api } from "@/lib/api/client";

interface UserPayload {
  user: AuthUser;
}

export const authApi = {
  register: (input: RegisterInput) => api.post<UserPayload>("/auth/register", input),
  login: (input: LoginInput) => api.post<UserPayload>("/auth/login", input),
  logout: () => api.post<{ message: string }>("/auth/logout"),
  me: () => api.get<UserPayload>("/auth/me"),
};
