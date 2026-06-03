import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { LayoutShell } from "@/components/layout-shell";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, UserPlus, RotateCcw, UserX, UserCheck } from "lucide-react";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Role } from "@shared/schema";

const createUserSchema = z.object({
  username: z.string().min(2, "Username must be at least 2 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  roleId: z.string().min(1, "Role is required"),
  password: z.string().min(4, "Password must be at least 4 characters"),
  confirmPassword: z.string().min(1, "Please confirm the password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(4, "Password must be at least 4 characters"),
});

export default function AdminUsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetUserName, setResetUserName] = useState("");

  const { data: usersData, isLoading: loadingUsers } = useQuery<any[]>({
    queryKey: ['/api/users'],
  });

  const { data: rolesData } = useQuery<Role[]>({
    queryKey: ['/api/roles'],
  });

  const createUserForm = useForm<z.infer<typeof createUserSchema>>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      roleId: "",
      password: "",
      confirmPassword: "",
    },
  });

  const resetPasswordForm = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "" },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createUserSchema>) => {
      const { confirmPassword, ...payload } = data;
      return apiRequest("POST", "/api/users", {
        ...payload,
        roleId: Number(payload.roleId),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setCreateDialogOpen(false);
      createUserForm.reset();
      toast({ title: "User created successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to create user", description: err.message, variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: number; newPassword: string }) => {
      return apiRequest("PUT", `/api/users/${userId}/reset-password`, { newPassword });
    },
    onSuccess: () => {
      setResetDialogOpen(false);
      resetPasswordForm.reset();
      toast({ title: "Password reset successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to reset password", description: err.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: number; isActive: boolean }) => {
      return apiRequest("PUT", `/api/users/${userId}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({ title: "User status updated" });
    },
  });

  const users = usersData || [];
  const roles = rolesData || [];

  if (loadingUsers) {
    return (
      <LayoutShell>
        <div className="flex h-[80vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </LayoutShell>
    );
  }

  return (
    <LayoutShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">User Management</h1>
            <p className="text-muted-foreground mt-1">Manage system users and their roles</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-user">
                <UserPlus className="mr-2 h-4 w-4" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
              </DialogHeader>
              <Form {...createUserForm}>
                <form onSubmit={createUserForm.handleSubmit((data) => createUserMutation.mutate(data))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={createUserForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-first-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createUserForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-last-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={createUserForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-username" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createUserForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createUserForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone (optional)</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createUserForm.control}
                    name="roleId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-role">
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={String(role.id)} data-testid={`option-role-${role.name}`}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createUserForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Temporary Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} data-testid="input-temp-password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createUserForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} data-testid="input-confirm-temp-password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={createUserMutation.isPending}
                    data-testid="button-submit-create-user"
                  >
                    {createUserMutation.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
                    ) : (
                      "Create User"
                    )}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">User</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Username</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Email</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Role</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Status</th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any) => (
                    <tr key={u.id} className="border-b border-border/30" data-testid={`row-user-${u.id}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border border-border">
                            <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
                              {u.firstName?.charAt(0)}{u.lastName?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm" data-testid={`text-user-name-${u.id}`}>{u.firstName} {u.lastName}</p>
                            {u.phone && <p className="text-xs text-muted-foreground">{u.phone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground" data-testid={`text-username-${u.id}`}>{u.username}</td>
                      <td className="p-4 text-sm text-muted-foreground">{u.email}</td>
                      <td className="p-4">
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-role-${u.id}`}>
                          {u.role?.name || "No role"}
                        </Badge>
                      </td>
                      <td className="p-4">
                        {u.isActive ? (
                          <Badge variant="default" className="text-xs bg-emerald-600">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                        {u.mustChangePassword && (
                          <Badge variant="outline" className="text-xs ml-1">Pending PW</Badge>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setResetUserId(u.id);
                              setResetUserName(`${u.firstName} ${u.lastName}`);
                              setResetDialogOpen(true);
                              resetPasswordForm.reset();
                            }}
                            title="Reset Password"
                            data-testid={`button-reset-password-${u.id}`}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          {u.isActive ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleActiveMutation.mutate({ userId: u.id, isActive: false })}
                              title="Deactivate User"
                              data-testid={`button-deactivate-${u.id}`}
                            >
                              <UserX className="h-4 w-4 text-destructive" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleActiveMutation.mutate({ userId: u.id, isActive: true })}
                              title="Activate User"
                              data-testid={`button-activate-${u.id}`}
                            >
                              <UserCheck className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Reset Password for {resetUserName}</DialogTitle>
          </DialogHeader>
          <Form {...resetPasswordForm}>
            <form onSubmit={resetPasswordForm.handleSubmit((data) => {
              if (resetUserId) resetPasswordMutation.mutate({ userId: resetUserId, newPassword: data.newPassword });
            })} className="space-y-4">
              <FormField
                control={resetPasswordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Temporary Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} data-testid="input-reset-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full" 
                disabled={resetPasswordMutation.isPending}
                data-testid="button-submit-reset-password"
              >
                {resetPasswordMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting...</>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </LayoutShell>
  );
}
