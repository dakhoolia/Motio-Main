import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type Task } from "@shared/routes";
import { z } from "zod";

type InsertTask = z.infer<typeof api.tasks.create.input>;

export function useTasks(params?: { vehicleId?: number; assigneeId?: number; status?: string }) {
  const queryKey = [api.tasks.list.path, params];
  return useQuery({
    queryKey,
    queryFn: async () => {
      const url = new URL(api.tasks.list.path, window.location.origin);
      if (params?.vehicleId) url.searchParams.append("vehicleId", String(params.vehicleId));
      if (params?.assigneeId) url.searchParams.append("assigneeId", String(params.assigneeId));
      if (params?.status) url.searchParams.append("status", params.status);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return api.tasks.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertTask) => {
      const res = await fetch(api.tasks.create.path, {
        method: api.tasks.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create task");
      return api.tasks.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] }),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertTask>) => {
      const url = buildUrl(api.tasks.update.path, { id });
      const res = await fetch(url, {
        method: api.tasks.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update task");
      return api.tasks.update.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] }),
  });
}
