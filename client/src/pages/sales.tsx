import { useState } from "react";
import { LayoutShell } from "@/components/layout-shell";
import { useSales } from "@/hooks/use-sales";
import { useUsers } from "@/hooks/use-vehicles";

import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, DollarSign, Car, Calendar, Pencil, Check, X } from "lucide-react";
import { Link } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

type TimePeriod = "7" | "30" | "90" | "365" | "all";

const periodOptions: { value: TimePeriod; label: string }[] = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last month" },
  { value: "90", label: "Last 3 months" },
  { value: "365", label: "Last year" },
  { value: "all", label: "All time" },
];

export default function SalesPage() {
  const [period, setPeriod] = useState<TimePeriod>("7");
  const days = period === "all" ? undefined : parseInt(period);
  const { data: sales, isLoading } = useSales(days);
  const { data: usersList } = useUsers();
  const [editingSaleId, setEditingSaleId] = useState<number | null>(null);
  const [editSellerId, setEditSellerId] = useState<string>("");
  const [editIntakerId, setEditIntakerId] = useState<string>("");
  const { toast } = useToast();

  const updateSaleMutation = useMutation({
    mutationFn: async ({ saleId, sellerId }: { saleId: number; sellerId: number }) => {
      return apiRequest("PUT", `/api/sales/${saleId}`, { sellerId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.sales.list.path], exact: false });
      toast({ title: "Seller updated successfully" });
    },
  });

  const updateIntakerMutation = useMutation({
    mutationFn: async ({ vehicleId, addedById }: { vehicleId: number; addedById: number }) => {
      return apiRequest("PUT", `/api/vehicles/${vehicleId}/intaker`, { addedById });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.sales.list.path], exact: false });
      toast({ title: "Intaker updated successfully" });
    },
  });

  const startEditing = (sale: any) => {
    setEditingSaleId(sale.id);
    setEditSellerId(String(sale.sellerId));
    setEditIntakerId(sale.vehicle?.addedById ? String(sale.vehicle.addedById) : "");
  };

  const saveEditing = async (sale: any) => {
    const newSellerId = parseInt(editSellerId);
    const newIntakerId = parseInt(editIntakerId);

    if (newSellerId && newSellerId !== sale.sellerId) {
      await updateSaleMutation.mutateAsync({ saleId: sale.id, sellerId: newSellerId });
    }
    if (newIntakerId && newIntakerId !== sale.vehicle?.addedById) {
      await updateIntakerMutation.mutateAsync({ vehicleId: sale.vehicleId, addedById: newIntakerId });
    }
    setEditingSaleId(null);
  };

  if (isLoading) {
    return (
      <LayoutShell>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </LayoutShell>
    );
  }

  const salesList = sales || [];
  
  const totalRevenue = salesList.reduce((sum: number, sale: any) => 
    sum + Number(sale.salePrice || 0), 0);
  const totalCost = salesList.reduce((sum: number, sale: any) => 
    sum + Number(sale.buyPrice || sale.vehicle?.buyPrice || 0), 0);
  const totalServiceCosts = salesList.reduce((sum: number, sale: any) => 
    sum + Number(sale.serviceCost || 0), 0);
  const totalProfit = totalRevenue - totalCost - totalServiceCosts;
  const avgSalePrice = salesList.length > 0 ? totalRevenue / salesList.length : 0;

  return (
    <LayoutShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Sales</h1>
            <p className="text-muted-foreground mt-1">Track vehicle sales and revenue</p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {periodOptions.map((option) => (
              <Button
                key={option.value}
                variant={period === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod(option.value)}
                data-testid={`filter-period-${option.value}`}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Revenue", value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, bg: "bg-emerald-50 dark:bg-emerald-950/30", color: "text-emerald-600" },
            { label: "Total Profit", value: `$${totalProfit.toLocaleString()}`, icon: TrendingUp, bg: "bg-blue-50 dark:bg-blue-950/30", color: totalProfit >= 0 ? "text-emerald-600" : "text-red-600" },
            { label: "Vehicles Sold", value: salesList.length, icon: Car, bg: "bg-purple-50 dark:bg-purple-950/30", color: "text-purple-600" },
            { label: "Avg Sale Price", value: `$${avgSalePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: Calendar, bg: "bg-amber-50 dark:bg-amber-950/30", color: "text-amber-600" },
          ].map(({ label, value, icon: Icon, bg, color }) => (
            <div key={label} className="glass-card rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1">{label}</p>
                  <h3 className={`text-[1.75rem] font-bold leading-none ${color}`}
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.04em" }}>
                    {value}
                  </h3>
                </div>
                <div className={`p-2.5 rounded-xl ${bg} ${color} shrink-0`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
            <h3 className="font-semibold text-foreground">Recent Sales</h3>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {salesList.length === 0
                ? "No sales in this period"
                : `Showing ${salesList.length} sale${salesList.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div>
            {salesList.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Car className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No sales recorded for this time period.</p>
                <p className="text-sm mt-2">Sales will appear here once vehicles are sold.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Vehicle</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Buyer</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Seller</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Intaker</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Sale Date</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Sale Price</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Profit</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesList.map((sale: any) => {
                      const buyPrice = Number(sale.buyPrice || sale.vehicle?.buyPrice || 0);
                      const serviceCost = Number(sale.serviceCost || 0);
                      const salePrice = Number(sale.salePrice || 0);
                      const profit = salePrice - buyPrice - serviceCost;
                      const isEditing = editingSaleId === sale.id;
                      
                      return (
                        <tr key={sale.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4">
                            <Link href={`/vehicles/${sale.vehicleId}`}>
                              <span className="font-medium hover:text-primary cursor-pointer" data-testid={`sale-vehicle-${sale.id}`}>
                                {sale.vehicle?.year} {sale.vehicle?.make} {sale.vehicle?.model}
                              </span>
                            </Link>
                            <p className="text-xs text-muted-foreground">{sale.vehicle?.regNo}</p>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-medium">{sale.buyerName}</span>
                            {sale.buyerPhone && (
                              <p className="text-xs text-muted-foreground">{sale.buyerPhone}</p>
                            )}
                          </td>
                          <td className="py-3 px-4" data-testid={`sale-seller-${sale.id}`}>
                            {isEditing ? (
                              <Select value={editSellerId} onValueChange={setEditSellerId}>
                                <SelectTrigger className="w-[140px]" data-testid={`select-edit-seller-${sale.id}`}>
                                  <SelectValue placeholder="Select seller" />
                                </SelectTrigger>
                                <SelectContent>
                                  {usersList?.map((u: any) => (
                                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-sm">{sale.seller?.name || 'Unknown'}</span>
                            )}
                          </td>
                          <td className="py-3 px-4" data-testid={`sale-intaker-${sale.id}`}>
                            {isEditing ? (
                              <Select value={editIntakerId} onValueChange={setEditIntakerId}>
                                <SelectTrigger className="w-[140px]" data-testid={`select-edit-intaker-${sale.id}`}>
                                  <SelectValue placeholder="Select intaker" />
                                </SelectTrigger>
                                <SelectContent>
                                  {usersList?.map((u: any) => (
                                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-sm">{sale.vehicle?.intaker?.name || 'Not set'}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm">
                            {sale.soldAt ? new Date(sale.soldAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-sm font-medium">
                            ${salePrice.toLocaleString()}
                          </td>
                          <td className={`py-3 px-4 text-right font-mono text-sm font-medium ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            ${profit.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isEditing ? (
                              <div className="flex items-center gap-1 justify-center">
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={() => saveEditing(sale)}
                                  disabled={updateSaleMutation.isPending || updateIntakerMutation.isPending}
                                  data-testid={`button-save-sale-${sale.id}`}
                                >
                                  {(updateSaleMutation.isPending || updateIntakerMutation.isPending) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Check className="h-4 w-4 text-emerald-600" />
                                  )}
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={() => setEditingSaleId(null)}
                                  data-testid={`button-cancel-edit-${sale.id}`}
                                >
                                  <X className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </div>
                            ) : (
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => startEditing(sale)}
                                data-testid={`button-edit-sale-${sale.id}`}
                              >
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </LayoutShell>
  );
}
