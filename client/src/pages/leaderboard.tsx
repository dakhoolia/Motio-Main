import { useState, useMemo } from "react";
import { LayoutShell } from "@/components/layout-shell";
import { useSales } from "@/hooks/use-sales";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Trophy, TrendingUp, Car, DollarSign, Percent, Crown, PackagePlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

type TimePeriod = "1" | "7" | "30" | "90" | "365" | "lastyear" | "all";
type SortMetric = "carsSold" | "carsIntake" | "turnover" | "totalEarnings" | "margin" | "avgSalePrice";

const periodOptions: { value: TimePeriod; label: string }[] = [
  { value: "1", label: "Today" },
  { value: "7", label: "Weekly" },
  { value: "30", label: "Monthly" },
  { value: "90", label: "Quarterly" },
  { value: "365", label: "Yearly" },
  { value: "lastyear", label: "Last Year" },
  { value: "all", label: "All Time" },
];

const sortOptions: { value: SortMetric; label: string; icon: any }[] = [
  { value: "carsSold", label: "Most Cars Sold", icon: Car },
  { value: "carsIntake", label: "Most Cars Intake", icon: PackagePlus },
  { value: "turnover", label: "Highest Turnover", icon: DollarSign },
  { value: "totalEarnings", label: "Highest Earnings", icon: TrendingUp },
  { value: "margin", label: "Best Margin", icon: Percent },
  { value: "avgSalePrice", label: "Avg Sale Price", icon: DollarSign },
];

interface EmployeeStats {
  id: number;
  name: string;
  carsSold: number;
  carsIntake: number;
  turnover: number;
  totalEarnings: number;
  margin: number;
  avgSalePrice: number;
  totalBuyPrice: number;
  totalServiceCost: number;
}

function computeLeaderboard(
  salesList: any[], 
  period: TimePeriod,
  intakeData: { userId: number; userName: string; count: number }[]
): EmployeeStats[] {
  let filtered = salesList;

  if (period === "lastyear") {
    const lastYear = new Date().getFullYear() - 1;
    filtered = salesList.filter((sale: any) => {
      const saleDate = new Date(sale.soldAt);
      return saleDate.getFullYear() === lastYear;
    });
  }

  const employeeMap = new Map<number, EmployeeStats>();

  filtered.forEach((sale: any) => {
    const sellerId = sale.sellerId;
    const sellerName = sale.seller?.name || "Unknown";
    const salePrice = Number(sale.salePrice || 0);
    const buyPrice = Number(sale.buyPrice || sale.vehicle?.buyPrice || 0);
    const serviceCost = Number(sale.serviceCost || 0);
    const profit = salePrice - buyPrice - serviceCost;

    if (!employeeMap.has(sellerId)) {
      employeeMap.set(sellerId, {
        id: sellerId,
        name: sellerName,
        carsSold: 0,
        carsIntake: 0,
        turnover: 0,
        totalEarnings: 0,
        margin: 0,
        avgSalePrice: 0,
        totalBuyPrice: 0,
        totalServiceCost: 0,
      });
    }

    const stats = employeeMap.get(sellerId)!;
    stats.carsSold += 1;
    stats.turnover += salePrice;
    stats.totalEarnings += profit;
    stats.totalBuyPrice += buyPrice;
    stats.totalServiceCost += serviceCost;
    stats.avgSalePrice = stats.turnover / stats.carsSold;
    stats.margin = stats.turnover > 0
      ? (stats.totalEarnings / stats.turnover) * 100
      : 0;
  });

  intakeData.forEach((intake) => {
    if (employeeMap.has(intake.userId)) {
      employeeMap.get(intake.userId)!.carsIntake = intake.count;
    } else {
      employeeMap.set(intake.userId, {
        id: intake.userId,
        name: intake.userName,
        carsSold: 0,
        carsIntake: intake.count,
        turnover: 0,
        totalEarnings: 0,
        margin: 0,
        avgSalePrice: 0,
        totalBuyPrice: 0,
        totalServiceCost: 0,
      });
    }
  });

  return Array.from(employeeMap.values());
}

const medalColors = [
  { bg: "bg-amber-100 dark:bg-amber-900/30", border: "border-amber-300 dark:border-amber-700", text: "text-amber-700 dark:text-amber-300", crown: "text-amber-500" },
  { bg: "bg-slate-100 dark:bg-slate-800/50", border: "border-slate-300 dark:border-slate-600", text: "text-slate-600 dark:text-slate-300", crown: "text-slate-400" },
  { bg: "bg-orange-100 dark:bg-orange-900/30", border: "border-orange-300 dark:border-orange-700", text: "text-orange-700 dark:text-orange-300", crown: "text-orange-600" },
];

function formatValue(value: number, metric: SortMetric): string {
  if (metric === "margin") return `${value.toFixed(1)}%`;
  if (metric === "carsSold") return String(value);
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function getMetricLabel(metric: SortMetric): string {
  return sortOptions.find(s => s.value === metric)?.label || metric;
}

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<TimePeriod>("30");
  const [sortBy, setSortBy] = useState<SortMetric>("carsSold");

  const days = period === "all" || period === "lastyear" ? undefined : parseInt(period);
  const { data: sales, isLoading: salesLoading } = useSales(days);
  
  const intakeDays = period === "all" || period === "lastyear" ? "" : period;
  const { data: intakeData, isLoading: intakeLoading } = useQuery<{ userId: number; userName: string; count: number }[]>({
    queryKey: ['/api/leaderboard/intake', intakeDays],
    queryFn: async () => {
      const url = intakeDays ? `/api/leaderboard/intake?days=${intakeDays}` : '/api/leaderboard/intake';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch intake data');
      return res.json();
    },
  });
  
  const isLoading = salesLoading || intakeLoading;

  const leaderboard = useMemo(() => {
    if (!sales) return [];
    const stats = computeLeaderboard(sales, period, intakeData || []);
    return stats.sort((a, b) => b[sortBy] - a[sortBy]);
  }, [sales, intakeData, period, sortBy]);

  const topThree = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  if (isLoading) {
    return (
      <LayoutShell>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </LayoutShell>
    );
  }

  return (
    <LayoutShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
              <Trophy className="h-8 w-8 text-amber-500" />
              Leaderboard
            </h1>
            <p className="text-muted-foreground mt-1">Employee performance rankings</p>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
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

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortMetric)}>
              <SelectTrigger className="w-[200px]" data-testid="select-sort-metric">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {leaderboard.length === 0 ? (
          <div className="glass-card rounded-2xl py-16 text-center">
            <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold text-muted-foreground">No sales data</h3>
            <p className="text-sm text-muted-foreground mt-1">
              No sales found for this time period. Sell some vehicles to see the rankings.
            </p>
          </div>
        ) : (
          <>
            {/* Podium - Top 3 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 0, 2].map((podiumIndex) => {
                const employee = topThree[podiumIndex];
                if (!employee) return <div key={`empty-${podiumIndex}`} />;
                const rank = podiumIndex + 1;
                const colors = medalColors[podiumIndex];
                const isFirst = podiumIndex === 0;

                return (
                  <div
                    key={employee.id}
                    className={`glass-card rounded-2xl p-6 flex flex-col items-center text-center border-2 ${colors.border}`}
                    data-testid={`podium-rank-${rank}`}
                  >
                    <div className="relative mb-3">
                      {isFirst && (
                        <Crown className={`h-6 w-6 ${colors.crown} absolute -top-5 left-1/2 -translate-x-1/2`} />
                      )}
                      <Avatar className={`h-16 w-16 border-2 ${colors.border}`}>
                        <AvatarFallback className={`${colors.bg} ${colors.text} text-xl font-bold`}>
                          {employee.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`absolute -bottom-2 -right-2 h-7 w-7 rounded-full flex items-center justify-center text-sm font-bold ${
                        rank === 1 ? 'bg-amber-500 text-white' :
                        rank === 2 ? 'bg-slate-400 text-white' :
                        'bg-orange-500 text-white'
                      }`}>
                        {rank}
                      </div>
                    </div>

                    <h3 className="font-semibold text-lg mt-2">{employee.name}</h3>
                    <p className={`text-2xl font-bold mt-1 ${colors.text}`}>
                      {formatValue(employee[sortBy], sortBy)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {getMetricLabel(sortBy)}
                    </p>

                    <div className="grid grid-cols-2 gap-3 mt-4 w-full">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Cars Sold</p>
                        <p className="font-semibold">{employee.carsSold}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Turnover</p>
                        <p className="font-semibold">${employee.turnover.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Earnings</p>
                        <p className={`font-semibold ${employee.totalEarnings >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          ${employee.totalEarnings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Margin</p>
                        <p className="font-semibold">{employee.margin.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Full Rankings Table */}
            {rest.length > 0 && (
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground w-12">Rank</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Employee</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Cars Sold</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Intake</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Turnover</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Earnings</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Margin</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Avg Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rest.map((employee, index) => (
                          <tr
                            key={employee.id}
                            className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                            data-testid={`leaderboard-row-${employee.id}`}
                          >
                            <td className="py-3 px-4">
                              <span className="text-sm font-medium text-muted-foreground">{index + 4}</span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="text-xs font-medium">
                                    {employee.name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium">{employee.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-sm">{employee.carsSold}</td>
                            <td className="py-3 px-4 text-right font-mono text-sm">{employee.carsIntake}</td>
                            <td className="py-3 px-4 text-right font-mono text-sm">
                              ${employee.turnover.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </td>
                            <td className={`py-3 px-4 text-right font-mono text-sm font-medium ${employee.totalEarnings >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              ${employee.totalEarnings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-sm">{employee.margin.toFixed(1)}%</td>
                            <td className="py-3 px-4 text-right font-mono text-sm">
                              ${employee.avgSalePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
            )}

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Cars Sold", value: leaderboard.reduce((sum, e) => sum + e.carsSold, 0), color: "text-foreground" },
                { label: "Total Turnover", value: `$${leaderboard.reduce((sum, e) => sum + e.turnover, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: "text-foreground" },
                { label: "Total Earnings", value: `$${leaderboard.reduce((sum, e) => sum + e.totalEarnings, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: leaderboard.reduce((sum, e) => sum + e.totalEarnings, 0) >= 0 ? "text-emerald-600" : "text-red-600" },
                { label: "Active Sellers", value: leaderboard.length, color: "text-foreground" },
              ].map(({ label, value, color }) => (
                <div key={label} className="glass-card rounded-2xl p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </LayoutShell>
  );
}
