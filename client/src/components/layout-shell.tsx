import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_NAMES } from "@shared/schema";
import {
  LayoutDashboard,
  Car,
  CheckSquare,
  LogOut,
  Users,
  Menu,
  DollarSign,
  Trophy,
  MessageCircle,
  Camera,
  Trash2,
  FileText,
  Sun,
  Moon,
  type LucideIcon,
} from "lucide-react";
import logoImg from "@assets/logo_1780527843786.png";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { UserAvatar } from "@/components/user-avatar";
import { useTheme } from "@/components/theme-provider";
import type { ConversationWithDetails } from "@shared/schema";
import type { UserWithRole } from "@/hooks/use-auth";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  roles?: string[];
  badge?: number;
}

function AvatarEditDialog({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: UserWithRole;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await fetch("/api/users/me/avatar", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message);
      }
      return res.json() as Promise<UserWithRole>;
    },
    onSuccess: (updated) => {
      qc.setQueryData(["/api/user"], updated);
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Profile picture updated", duration: 3000 });
      setPreview(null);
      setSelectedFile(null);
      onClose();
    },
    onError: (e: Error) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/users/me/avatar", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Remove failed");
      return res.json() as Promise<UserWithRole>;
    },
    onSuccess: (updated) => {
      qc.setQueryData(["/api/user"], updated);
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Profile picture removed", duration: 3000 });
      onClose();
    },
    onError: () => toast({ title: "Could not remove picture", variant: "destructive" }),
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleSave() {
    if (selectedFile) uploadMutation.mutate(selectedFile);
  }

  const isPending = uploadMutation.isPending || removeMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setPreview(null); setSelectedFile(null); onClose(); } }}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Profile Picture</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-5 py-2">
          <div
            className="relative group cursor-pointer"
            onClick={() => fileRef.current?.click()}
            data-testid="avatar-click-area"
          >
            <UserAvatar
              name={user.name}
              avatarUrl={preview ?? user.avatarUrl}
              className="h-24 w-24 border-2 border-border"
              fallbackClassName="text-2xl"
            />
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="h-6 w-6 text-white" />
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {preview ? "Click Save to apply your new photo" : "Click your photo to choose a new one"}
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
            data-testid="input-avatar-file"
          />

          <div className="flex gap-2 w-full">
            {preview ? (
              <>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setPreview(null); setSelectedFile(null); }}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSave}
                  disabled={isPending}
                  data-testid="button-save-avatar"
                >
                  {uploadMutation.isPending ? "Saving…" : "Save"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => fileRef.current?.click()}
                  disabled={isPending}
                  data-testid="button-choose-photo"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Choose Photo
                </Button>
                {user.avatarUrl && (
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeMutation.mutate()}
                    disabled={isPending}
                    data-testid="button-remove-avatar"
                  >
                    {removeMutation.isPending ? "…" : <Trash2 className="h-4 w-4" />}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LayoutShell({ children, chatLayout }: { children: React.ReactNode; chatLayout?: boolean }) {
  const [location] = useLocation();
  const { user, logout, roleName } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);

  const { data: conversations = [] } = useQuery<ConversationWithDetails[]>({
    queryKey: ["/api/conversations"],
    refetchInterval: 15000,
  });

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);

  const allNavigation: NavItem[] = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Vehicles", href: "/vehicles", icon: Car },
    { name: "Tasks", href: "/tasks", icon: CheckSquare },
    { name: "Sales", href: "/sales", icon: DollarSign },
    { name: "Kontrakter", href: "/contracts", icon: FileText },
    { name: "Leaderboard", href: "/leaderboard", icon: Trophy },
    { name: "Messages", href: "/chat", icon: MessageCircle, badge: totalUnread },
    { name: "Users", href: "/admin/users", icon: Users, roles: [ROLE_NAMES.ADMIN] },
  ];

  const navigation = allNavigation.filter((item) => {
    if (!item.roles) return true;
    return roleName && item.roles.includes(roleName);
  });

  const SidebarContent = () => (
    <div className="flex h-full flex-col sidebar-glass w-64">
      {/* Logo + Theme toggle */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl overflow-hidden shadow-sm flex-shrink-0">
            <img src={logoImg} alt="Motio logo" className="h-full w-full object-cover" />
          </div>
          <span className="text-[1.1rem] font-bold tracking-tight text-foreground"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.03em" }}>
            Motio
          </span>
        </div>
        <button
          onClick={toggleTheme}
          data-testid="button-toggle-theme"
          className="h-8 w-8 rounded-full flex items-center justify-center transition-all duration-200
            text-muted-foreground hover:text-foreground
            bg-black/5 hover:bg-black/10
            dark:bg-white/8 dark:hover:bg-white/15"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark"
            ? <Sun className="h-4 w-4" />
            : <Moon className="h-4 w-4" />
          }
        </button>
      </div>

      {/* Nav label */}
      <div className="px-5 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          Navigation
        </p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {navigation.map((item) => {
          const isActive =
            item.href === "/" ? location === "/" : location.startsWith(item.href);
          return (
            <Link key={item.name} href={item.href}>
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-150 cursor-pointer ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                style={isActive ? {
                  background: "rgba(10, 132, 255, 0.1)",
                } : {}}
                data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className={`flex items-center justify-center h-7 w-7 rounded-lg transition-all ${
                  isActive
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted-foreground"
                }`}
                style={isActive ? { boxShadow: "0 2px 8px rgba(10, 132, 255, 0.35)" } : {}}>
                  <item.icon className="h-[15px] w-[15px]" />
                </div>
                <span className="flex-1">{item.name}</span>
                {item.badge != null && item.badge > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white shadow-sm">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 mt-2">
        <div
          className="rounded-xl p-3 mb-2 transition-colors"
          style={{ background: "rgba(0,0,0,0.04)" }}
        >
          <div className="flex items-center gap-3 dark:bg-white/[0.03]">
            <button
              className="relative group shrink-0"
              onClick={() => setAvatarDialogOpen(true)}
              data-testid="button-edit-avatar"
              title="Edit profile picture"
            >
              <UserAvatar
                name={user?.name ?? ""}
                avatarUrl={user?.avatarUrl}
                className="h-9 w-9 ring-2 ring-white/60 dark:ring-white/10"
              />
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-3 w-3 text-white" />
              </div>
            </button>
            <div className="flex-1 overflow-hidden">
              <p className="text-[13px] font-semibold truncate text-foreground leading-tight">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">{roleName || "User"}</p>
            </div>
          </div>
        </div>
        <button
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground transition-all duration-150 hover:bg-black/5 dark:hover:bg-white/5"
          onClick={() => logout()}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <div className="hidden md:block fixed inset-y-0 z-50 w-64">
        <SidebarContent />
      </div>

      {/* Mobile header */}
      <header className="md:hidden sticky top-0 z-50 sidebar-glass border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center justify-between h-14 px-4">
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-0">
              <SidebarContent />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg overflow-hidden flex-shrink-0">
              <img src={logoImg} alt="Motio logo" className="h-full w-full object-cover" />
            </div>
            <span className="text-[1rem] font-bold tracking-tight text-foreground"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.03em" }}>
              Motio
            </span>
          </div>

          <button
            onClick={toggleTheme}
            data-testid="button-toggle-theme-mobile"
            className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground bg-black/5 hover:bg-black/10 dark:bg-white/8 dark:hover:bg-white/15 transition-all"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Main content */}
      {chatLayout ? (
        <main
          className="flex-1 md:ml-64 flex flex-col p-3 md:p-4 overflow-hidden"
          style={{ height: "100dvh" }}
        >
          {children}
        </main>
      ) : (
        <main className="flex-1 md:ml-64 p-5 md:p-8 animate-in overflow-x-hidden">
          <div className="max-w-7xl mx-auto space-y-6">{children}</div>
        </main>
      )}

      {user && (
        <AvatarEditDialog
          open={avatarDialogOpen}
          onClose={() => setAvatarDialogOpen(false)}
          user={user}
        />
      )}
    </div>
  );
}
