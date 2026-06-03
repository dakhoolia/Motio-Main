import { useVehicles } from "@/hooks/use-vehicles";
import { useTasks } from "@/hooks/use-tasks";
import { useAuth } from "@/hooks/use-auth";
import { LayoutShell } from "@/components/layout-shell";

import { Loader2, Car, AlertCircle, CheckCircle2, DollarSign, Plus, Wrench } from "lucide-react";
import { VehicleCard } from "@/components/vehicle-card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ROLE_NAMES } from "@shared/schema";

export default function DashboardPage() {
  const { user, roleName } = useAuth();
  const { data: vehiclesData, isLoading: isLoadingVehicles } = useVehicles({ page: 1 });
  const { data: tasksData, isLoading: isLoadingTasks } = useTasks({ status: "Open" });

  if (isLoadingVehicles || isLoadingTasks) {
    return (
      <LayoutShell>
        <div className="flex h-[80vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </LayoutShell>
    );
  }

  const vehicles = vehiclesData?.data || [];
  const tasks = tasksData || [];

  const totalVehicles = vehicles.length;
  const inStock = vehicles.filter(v => ["Intake", "Klargjøring", "Listed"].includes(v.status.name)).length;
  const soldCount = vehicles.filter(v => v.status.name === "Sold").length;
  const urgentTasks = tasks.filter(t => t.priority === "High").length;
  const prepVehicles = vehicles.filter(v => ["Klargjøring"].includes(v.status.name));
  const myTasks = tasks.filter(t => t.assignee?.id === user?.id);

  return (
    <LayoutShell>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            {getRoleGreeting(roleName, user?.firstName)}
          </h1>
          <p className="text-muted-foreground mt-1">{getRoleSubtitle(roleName)}</p>
        </div>

        {/* Stats Grid - varies by role */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(roleName === ROLE_NAMES.ADMIN || roleName === ROLE_NAMES.HYBRID) && (
            <>
              <StatCard title="Vehicles in Stock" value={inStock} icon={Car} color="text-blue-600" bgColor="bg-blue-50 dark:bg-blue-950/30" href="/vehicles" />
              <StatCard title="Sold" value={soldCount} icon={DollarSign} color="text-emerald-600" bgColor="bg-emerald-50 dark:bg-emerald-950/30" href="/sales" />
              <StatCard title="Open Tasks" value={tasks.length} icon={CheckCircle2} color="text-amber-600" bgColor="bg-amber-50 dark:bg-amber-950/30" href="/tasks" />
              <StatCard title="Urgent" value={urgentTasks} icon={AlertCircle} color="text-red-600" bgColor="bg-red-50 dark:bg-red-950/30" href="/tasks" />
            </>
          )}

          {roleName === ROLE_NAMES.INNKJOPER && (
            <>
              <StatCard title="My Vehicles" value={vehicles.filter(v => v.addedById === user?.id).length} icon={Car} color="text-blue-600" bgColor="bg-blue-50 dark:bg-blue-950/30" href="/vehicles" />
              <StatCard title="In Intake" value={vehicles.filter(v => v.status.name === "Intake").length} icon={Plus} color="text-emerald-600" bgColor="bg-emerald-50 dark:bg-emerald-950/30" href="/vehicles" />
              <StatCard title="My Tasks" value={myTasks.length} icon={CheckCircle2} color="text-amber-600" bgColor="bg-amber-50 dark:bg-amber-950/30" href="/tasks" />
              <StatCard title="Total Stock" value={inStock} icon={Car} color="text-purple-600" bgColor="bg-purple-50 dark:bg-purple-950/30" href="/vehicles" />
            </>
          )}

          {roleName === ROLE_NAMES.SELGER && (
            <>
              <StatCard title="Available Cars" value={vehicles.filter(v => ["Listed", "Reserved"].includes(v.status.name)).length} icon={Car} color="text-blue-600" bgColor="bg-blue-50 dark:bg-blue-950/30" href="/vehicles" />
              <StatCard title="Sold" value={soldCount} icon={DollarSign} color="text-emerald-600" bgColor="bg-emerald-50 dark:bg-emerald-950/30" href="/sales" />
              <StatCard title="In Stock" value={inStock} icon={Car} color="text-amber-600" bgColor="bg-amber-50 dark:bg-amber-950/30" href="/vehicles" />
              <StatCard title="Total Vehicles" value={totalVehicles} icon={Car} color="text-purple-600" bgColor="bg-purple-50 dark:bg-purple-950/30" href="/leaderboard" />
            </>
          )}

          {roleName === ROLE_NAMES.KLARGJORER && (
            <>
              <StatCard title="In Prep" value={prepVehicles.length} icon={Wrench} color="text-blue-600" bgColor="bg-blue-50 dark:bg-blue-950/30" href="/vehicles" />
              <StatCard title="My Tasks" value={myTasks.length} icon={CheckCircle2} color="text-amber-600" bgColor="bg-amber-50 dark:bg-amber-950/30" href="/tasks" />
              <StatCard title="Urgent" value={urgentTasks} icon={AlertCircle} color="text-red-600" bgColor="bg-red-50 dark:bg-red-950/30" href="/tasks" />
              <StatCard title="Open Tasks" value={tasks.length} icon={CheckCircle2} color="text-emerald-600" bgColor="bg-emerald-50 dark:bg-emerald-950/30" href="/tasks" />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Vehicles */}
          {roleName !== ROLE_NAMES.KLARGJORER && (
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-xl font-semibold">
                  {roleName === ROLE_NAMES.SELGER ? "Available for Sale" : "Recent Vehicles"}
                </h2>
                <Link href="/vehicles">
                  <Button variant="ghost">View All</Button>
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vehicles.slice(0, 4).map((vehicle) => (
                  <VehicleCard key={vehicle.id} vehicle={vehicle} />
                ))}
              </div>
            </div>
          )}

          {/* Task Feed */}
          <div className={`space-y-4 ${roleName === ROLE_NAMES.KLARGJORER ? "lg:col-span-3" : ""}`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xl font-semibold">
                {roleName === ROLE_NAMES.KLARGJORER ? "Prep Tasks" : "Pending Tasks"}
              </h2>
              <Link href="/tasks">
                <Button variant="ghost">View All</Button>
              </Link>
            </div>
            <div className="glass-card rounded-2xl overflow-hidden">
              {tasks.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No open tasks
                </div>
              ) : (
                <div>
                  {tasks.slice(0, roleName === ROLE_NAMES.KLARGJORER ? 10 : 5).map((task, i) => (
                    <div
                      key={task.id}
                      className="px-4 py-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
                      style={{ borderBottom: i < Math.min(tasks.length, roleName === ROLE_NAMES.KLARGJORER ? 10 : 5) - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}
                    >
                      <div className="flex justify-between items-start mb-1 gap-2">
                        <h4 className="font-medium text-[13px] text-foreground">{task.title}</h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                          task.priority === 'High' ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400' : 'bg-muted text-muted-foreground'
                        }`}>
                          {task.priority}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mb-1.5">
                        {task.vehicle ? `${task.vehicle.year} ${task.vehicle.model}` : 'General'}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(task.createdAt!).toLocaleDateString()}
                        </span>
                        <span className="text-[11px] font-semibold text-primary">
                          {task.assignee?.name || 'Unassigned'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </LayoutShell>
  );
}

function getRoleGreeting(roleName: string | null, firstName?: string): string {
  const name = firstName || "there";
  switch (roleName) {
    case ROLE_NAMES.ADMIN: return `Admin Dashboard`;
    case ROLE_NAMES.HYBRID: return `Dashboard`;
    case ROLE_NAMES.INNKJOPER: return `Minside - ${name}`;
    case ROLE_NAMES.SELGER: return `Minside - ${name}`;
    case ROLE_NAMES.KLARGJORER: return `Minside - ${name}`;
    default: return `Welcome, ${name}`;
  }
}

function getRoleSubtitle(roleName: string | null): string {
  switch (roleName) {
    case ROLE_NAMES.ADMIN: return "Full system overview and control";
    case ROLE_NAMES.HYBRID: return "Operational overview";
    case ROLE_NAMES.INNKJOPER: return "Your intake pipeline and vehicles";
    case ROLE_NAMES.SELGER: return "Your sales and available vehicles";
    case ROLE_NAMES.KLARGJORER: return "Prep pipeline and task management";
    default: return "Overview of your fleet operations";
  }
}

function StatCard({ title, value, icon: Icon, color, bgColor, href }: any) {
  return (
    <Link href={href}>
      <div
        className="glass-card rounded-2xl p-5 cursor-pointer hover-elevate group"
        data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1">{title}</p>
            <h3
              className="text-[2rem] font-bold text-foreground leading-none"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.04em" }}
            >
              {value}
            </h3>
          </div>
          <div className={`p-2.5 rounded-xl ${bgColor} ${color} shrink-0`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>
    </Link>
  );
}
