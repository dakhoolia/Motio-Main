import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";
import type { User, Role } from "@shared/schema";

export type UserWithRole = User & { role: Role | null };

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useQuery<UserWithRole | null>({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await fetch(api.auth.me.path);
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return await res.json();
    },
    retry: false,
    staleTime: Infinity,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: z.infer<typeof api.auth.login.input>) => {
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error("Invalid username or password");
        if (res.status === 429) throw new Error("Too many attempts — try again later");
        throw new Error("Login failed");
      }
      return await res.json() as UserWithRole | { mfaRequired: true };
    },
    onSuccess: (result) => {
      if (!("mfaRequired" in result)) {
        queryClient.setQueryData([api.auth.me.path], result);
      }
    },
  });

  const mfaLoginMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch("/api/auth/mfa/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: "Verifisering feilet" }));
        throw new Error(body.message);
      }
      return await res.json() as UserWithRole;
    },
    onSuccess: (user) => {
      queryClient.setQueryData([api.auth.me.path], user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(api.auth.logout.path, {
        method: api.auth.logout.method,
      });
      if (!res.ok) throw new Error("Logout failed");
    },
    onSuccess: () => {
      queryClient.setQueryData([api.auth.me.path], null);
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword?: string; newPassword: string }) => {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: "Password change failed" }));
        throw new Error(body.message);
      }
      return await res.json() as UserWithRole;
    },
    onSuccess: (user) => {
      queryClient.setQueryData([api.auth.me.path], user);
    },
  });

  const roleName = user?.role?.name || null;

  return {
    user,
    roleName,
    isLoading,
    error,
    login: loginMutation.mutateAsync,
    mfaLogin: mfaLoginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    changePassword: changePasswordMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending || mfaLoginMutation.isPending,
    isChangingPassword: changePasswordMutation.isPending,
  };
}
