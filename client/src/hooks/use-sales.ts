import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { InsertSale } from "@shared/schema";

export function useSales(days?: number) {
  const queryKey = days ? [api.sales.list.path, { days }] : [api.sales.list.path];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      const url = new URL(api.sales.list.path, window.location.origin);
      if (days) url.searchParams.set("days", String(days));
      
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sales");
      return res.json();
    },
  });
}

export function useCreateSale() {
  return useMutation({
    mutationFn: async (sale: InsertSale) => {
      return apiRequest("POST", api.sales.create.path, sale);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.sales.list.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
    },
  });
}
