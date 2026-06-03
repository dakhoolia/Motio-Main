import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertVehicle } from "@shared/routes";

export function useVehicles(params?: { statusId?: number; q?: string; page?: number }) {
  const queryKey = [api.vehicles.list.path, params];
  return useQuery({
    queryKey,
    queryFn: async () => {
      const url = new URL(api.vehicles.list.path, window.location.origin);
      if (params?.statusId) url.searchParams.append("statusId", String(params.statusId));
      if (params?.q) url.searchParams.append("q", params.q);
      if (params?.page) url.searchParams.append("page", String(params.page));
      
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch vehicles");
      return api.vehicles.list.responses[200].parse(await res.json());
    },
  });
}

export function useVehicle(id: number) {
  return useQuery({
    queryKey: [api.vehicles.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.vehicles.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch vehicle");
      return api.vehicles.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertVehicle) => {
      const res = await fetch(api.vehicles.create.path, {
        method: api.vehicles.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create vehicle");
      return api.vehicles.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      // Invalidate all vehicle queries regardless of filters
      queryClient.invalidateQueries({ queryKey: [api.vehicles.list.path], exact: false });
    },
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertVehicle>) => {
      const url = buildUrl(api.vehicles.update.path, { id });
      const res = await fetch(url, {
        method: api.vehicles.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update vehicle");
      return api.vehicles.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.vehicles.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.vehicles.get.path] });
    },
  });
}

// Metadata Hooks
export function useStatuses() {
  return useQuery({
    queryKey: [api.metadata.statuses.path],
    queryFn: async () => {
      const res = await fetch(api.metadata.statuses.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch statuses");
      return api.metadata.statuses.responses[200].parse(await res.json());
    },
  });
}

export function useLocations() {
  return useQuery({
    queryKey: [api.metadata.locations.path],
    queryFn: async () => {
      const res = await fetch(api.metadata.locations.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch locations");
      return api.metadata.locations.responses[200].parse(await res.json());
    },
  });
}

export function useUsers() {
  return useQuery({
    queryKey: [api.metadata.users.path],
    queryFn: async () => {
      const res = await fetch(api.metadata.users.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });
}

export function useVehicleSuggestions(q: string) {
  return useQuery({
    queryKey: [api.vehicles.suggestions.path, q],
    queryFn: async () => {
      if (!q || q.length < 1) return [];
      const url = new URL(api.vehicles.suggestions.path, window.location.origin);
      url.searchParams.append("q", q);
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch suggestions");
      return api.vehicles.suggestions.responses[200].parse(await res.json());
    },
    enabled: q.length >= 1,
  });
}
