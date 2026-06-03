import { useEffect } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

import LoginPage from "@/pages/login";
import ChangePasswordPage from "@/pages/change-password";
import DashboardPage from "@/pages/dashboard";
import VehiclesListPage from "@/pages/vehicles-list";
import VehicleDetailPage from "@/pages/vehicle-detail";
import TasksPage from "@/pages/tasks";
import SalesPage from "@/pages/sales";
import LeaderboardPage from "@/pages/leaderboard";
import AdminUsersPage from "@/pages/admin-users";
import ChatPage from "@/pages/chat";
import ShowroomPage from "@/pages/showroom";
import ShowroomDetailPage from "@/pages/showroom-detail";
import ContractsPage from "@/pages/contracts";
import ContractDetailPage from "@/pages/contract-detail";
import ContractTemplatesPage from "@/pages/contract-templates";
import NotFound from "@/pages/not-found";

function PrivateRoute({ component: Component, allowedRoles, ...rest }: any) {
  const { user, isLoading, roleName } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      setLocation("/login");
    } else if (user.mustChangePassword && location !== "/change-password") {
      setLocation("/change-password");
    } else if (allowedRoles && roleName && !allowedRoles.includes(roleName)) {
      setLocation("/");
    }
  }, [user, isLoading, roleName, location, allowedRoles, setLocation]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (user.mustChangePassword && location !== "/change-password") {
    return null;
  }

  if (allowedRoles && roleName && !allowedRoles.includes(roleName)) {
    return null;
  }

  return <Component {...rest} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/change-password">
        {() => <PrivateRoute component={ChangePasswordPage} />}
      </Route>
      
      <Route path="/">
        {() => <PrivateRoute component={DashboardPage} />}
      </Route>
      <Route path="/vehicles">
        {() => <PrivateRoute component={VehiclesListPage} />}
      </Route>
      <Route path="/vehicles/:id">
        {() => <PrivateRoute component={VehicleDetailPage} />}
      </Route>
      <Route path="/tasks">
        {() => <PrivateRoute component={TasksPage} />}
      </Route>
      <Route path="/sales">
        {() => <PrivateRoute component={SalesPage} />}
      </Route>
      <Route path="/leaderboard">
        {() => <PrivateRoute component={LeaderboardPage} />}
      </Route>
      <Route path="/admin/users">
        {() => <PrivateRoute component={AdminUsersPage} allowedRoles={["Admin"]} />}
      </Route>
      <Route path="/chat">
        {() => <PrivateRoute component={ChatPage} />}
      </Route>
      <Route path="/contracts">
        {() => <PrivateRoute component={ContractsPage} />}
      </Route>
      <Route path="/contracts/:id">
        {() => <PrivateRoute component={ContractDetailPage} />}
      </Route>
      <Route path="/contract-templates">
        {() => <PrivateRoute component={ContractTemplatesPage} allowedRoles={["Admin"]} />}
      </Route>

      <Route path="/showroom" component={ShowroomPage} />
      <Route path="/showroom/:id" component={ShowroomDetailPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
