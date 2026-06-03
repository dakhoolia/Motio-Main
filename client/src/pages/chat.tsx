import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { LayoutShell } from "@/components/layout-shell";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { ROLE_NAMES } from "@shared/schema";
import { format, isToday, isYesterday, differenceInCalendarDays } from "date-fns";
import {
  MessageCircle,
  Plus,
  Search,
  Send,
  Users,
  Loader2,
  ArrowLeft,
  UserPlus,
} from "lucide-react";
import type { ConversationWithDetails, MessageWithSender, User, Role } from "@shared/schema";

type UserWithRole = User & { role: Role | null };

function formatTime(date: string | Date) {
  const d = new Date(date);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Yesterday";
  if (differenceInCalendarDays(new Date(), d) < 7) return format(d, "EEE");
  return format(d, "dd/MM/yy");
}

function formatMessageTime(date: string | Date) {
  return format(new Date(date), "HH:mm");
}

function formatDateSeparator(date: string | Date) {
  const d = new Date(date);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMMM d, yyyy");
}

function ConversationName({ conv, currentUserId }: { conv: ConversationWithDetails; currentUserId: number }) {
  if (conv.type === "group") return <>{conv.name}</>;
  const other = conv.members.find(m => m.id !== currentUserId);
  return <>{other?.name ?? "Unknown"}</>;
}

function ConversationAvatar({ conv, currentUserId }: { conv: ConversationWithDetails; currentUserId: number }) {
  if (conv.type === "group") {
    return (
      <div className="h-10 w-10 shrink-0 rounded-full bg-primary/15 flex items-center justify-center">
        <Users className="h-5 w-5 text-primary" />
      </div>
    );
  }
  const other = conv.members.find(m => m.id !== currentUserId);
  return (
    <UserAvatar
      name={other?.name ?? "?"}
      avatarUrl={other?.avatarUrl}
      className="h-10 w-10"
      fallbackClassName="text-sm"
    />
  );
}

// ── New Direct Message Dialog ─────────────────────────────────────────────────
function NewDirectMessageDialog({
  users,
  currentUserId,
  onSelect,
}: {
  users: UserWithRole[];
  currentUserId: number;
  onSelect: (userId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = users.filter(
    u => u.id !== currentUserId && u.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-new-dm">
          <UserPlus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Search people..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          data-testid="input-search-user"
          autoFocus
        />
        <ScrollArea className="h-64 mt-2">
          <div className="space-y-1 pr-3">
            {filtered.map(u => (
              <button
                key={u.id}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors text-left"
                onClick={() => { onSelect(u.id); setOpen(false); }}
                data-testid={`button-start-dm-${u.id}`}
              >
                <UserAvatar name={u.name} avatarUrl={u.avatarUrl} className="h-8 w-8" fallbackClassName="text-xs" />
                <div>
                  <p className="text-sm font-medium">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.role?.name ?? "User"}</p>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No users found</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ── New Group Dialog (Admin only) ─────────────────────────────────────────────
function NewGroupDialog({
  users,
  currentUserId,
  onCreate,
}: {
  users: UserWithRole[];
  currentUserId: number;
  onCreate: (name: string, memberIds: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");

  const filtered = users.filter(
    u => u.id !== currentUserId && u.name.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(id: number) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function handleCreate() {
    if (!name.trim() || selected.length === 0) return;
    onCreate(name.trim(), selected);
    setOpen(false);
    setName("");
    setSelected([]);
    setSearch("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-new-group">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Group Chat</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Group name..."
            value={name}
            onChange={e => setName(e.target.value)}
            data-testid="input-group-name"
          />
          <Input
            placeholder="Search members..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-search-member"
          />
          <ScrollArea className="h-52">
            <div className="space-y-1 pr-3">
              {filtered.map(u => (
                <label
                  key={u.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent cursor-pointer"
                  data-testid={`label-member-${u.id}`}
                >
                  <Checkbox
                    checked={selected.includes(u.id)}
                    onCheckedChange={() => toggle(u.id)}
                    data-testid={`checkbox-member-${u.id}`}
                  />
                  <UserAvatar name={u.name} avatarUrl={u.avatarUrl} className="h-7 w-7" fallbackClassName="text-[10px]" />
                  <div>
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.role?.name ?? "User"}</p>
                  </div>
                </label>
              ))}
            </div>
          </ScrollArea>
          {selected.length > 0 && (
            <p className="text-xs text-muted-foreground">{selected.length} member{selected.length !== 1 ? "s" : ""} selected</p>
          )}
          <Button
            className="w-full"
            onClick={handleCreate}
            disabled={!name.trim() || selected.length === 0}
            data-testid="button-create-group"
          >
            Create Group
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, isMine, showSender, isGroup }: {
  msg: MessageWithSender;
  isMine: boolean;
  showSender: boolean;
  isGroup: boolean;
}) {
  return (
    <div className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
      {!isMine && (
        <UserAvatar name={msg.sender.name} avatarUrl={msg.sender.avatarUrl} className="h-7 w-7 shrink-0 mb-1" fallbackClassName="text-[10px]" />
      )}
      <div className={`max-w-[70%] ${isMine ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
        {isGroup && !isMine && showSender && (
          <span className="text-xs text-muted-foreground ml-1 font-medium">{msg.sender.name}</span>
        )}
        <div
          className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words ${
            isMine
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-muted text-foreground rounded-bl-sm"
          }`}
          data-testid={`message-bubble-${msg.id}`}
        >
          {msg.content}
        </div>
        <span className="text-[11px] text-muted-foreground px-1">{formatMessageTime(msg.createdAt)}</span>
      </div>
      {isMine && <div className="w-7 shrink-0" />}
    </div>
  );
}

// ── Main Chat Page ────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { user, roleName } = useAuth();
  const qc = useQueryClient();
  const isAdmin = roleName === ROLE_NAMES.ADMIN;

  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const activeConvIdRef = useRef<number | null>(null);

  useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: conversations = [], isLoading: convsLoading } = useQuery<ConversationWithDetails[]>({
    queryKey: ["/api/conversations"],
    refetchInterval: 15000,
  });

  const { data: allUsers = [] } = useQuery<UserWithRole[]>({
    queryKey: ["/api/users"],
  });

  const { data: messages = [], isLoading: msgsLoading } = useQuery<MessageWithSender[]>({
    queryKey: ["/api/conversations", activeConvId, "messages"],
    queryFn: async () => {
      if (!activeConvId) return [];
      const res = await fetch(`/api/conversations/${activeConvId}/messages?limit=50`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!activeConvId,
    refetchInterval: false,
  });

  const activeConv = conversations.find(c => c.id === activeConvId);

  // ── Scroll to bottom ─────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Mark as read when opening conversation ────────────────────────────────
  useEffect(() => {
    if (!activeConvId) return;
    apiRequest("POST", `/api/conversations/${activeConvId}/read`).catch(() => {});
    qc.invalidateQueries({ queryKey: ["/api/conversations"] });
  }, [activeConvId]);

  // ── Browser notification permission ──────────────────────────────────────
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // ── WebSocket real-time ───────────────────────────────────────────────────
  const connectWs = useCallback(async () => {
    try {
      const res = await fetch("/api/ws-token", { credentials: "include" });
      if (!res.ok) return;
      const { token } = await res.json();
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${proto}//${window.location.host}/ws?token=${token}`);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "new_message") {
            const convId: number = data.conversationId;
            const msg: MessageWithSender = data.message;
            qc.invalidateQueries({ queryKey: ["/api/conversations"] });

            const currentConvId = activeConvIdRef.current;
            if (convId === currentConvId) {
              qc.setQueryData<MessageWithSender[]>(
                ["/api/conversations", convId, "messages"],
                (old) => old ? [...old, msg] : [msg]
              );
              apiRequest("POST", `/api/conversations/${convId}/read`).catch(() => {});
            } else {
              // Show browser notification for messages in other conversations
              if (
                "Notification" in window &&
                Notification.permission === "granted" &&
                document.visibilityState !== "visible"
              ) {
                new Notification(msg.sender.name, {
                  body: msg.content.length > 80 ? msg.content.slice(0, 80) + "…" : msg.content,
                  icon: "/favicon.ico",
                  tag: `chat-${convId}`,
                });
              }
            }
          }
        } catch {}
      };

      ws.onclose = () => {
        wsRef.current = null;
        setTimeout(connectWs, 5000);
      };

      ws.onerror = () => ws.close();
    } catch {}
  }, [qc]);

  useEffect(() => {
    connectWs();
    return () => {
      wsRef.current?.close();
    };
  }, []);

  // Re-register activeConvId in WS message handler when it changes
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "new_message") {
          const convId: number = data.conversationId;
          qc.invalidateQueries({ queryKey: ["/api/conversations"] });
          if (convId === activeConvId) {
            qc.setQueryData<MessageWithSender[]>(
              ["/api/conversations", convId, "messages"],
              (old) => old ? [...old, data.message] : [data.message]
            );
            apiRequest("POST", `/api/conversations/${convId}/read`).catch(() => {});
          }
        }
      } catch {}
    };
  }, [activeConvId, qc]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/conversations/${activeConvId}/messages`, { content });
      return res.json();
    },
    onSuccess: (msg: MessageWithSender) => {
      qc.setQueryData<MessageWithSender[]>(
        ["/api/conversations", activeConvId, "messages"],
        (old) => old ? [...old, msg] : [msg]
      );
      qc.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  const startDm = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", "/api/conversations", { type: "direct", userId });
      return res.json() as Promise<ConversationWithDetails>;
    },
    onSuccess: (conv: ConversationWithDetails) => {
      qc.invalidateQueries({ queryKey: ["/api/conversations"] });
      setActiveConvId(conv.id);
      setMobileShowThread(true);
    },
  });

  const createGroup = useMutation({
    mutationFn: async ({ name, memberIds }: { name: string; memberIds: number[] }) => {
      const res = await apiRequest("POST", "/api/conversations", { type: "group", name, memberIds });
      return res.json() as Promise<ConversationWithDetails>;
    },
    onSuccess: (conv: ConversationWithDetails) => {
      qc.invalidateQueries({ queryKey: ["/api/conversations"] });
      setActiveConvId(conv.id);
      setMobileShowThread(true);
    },
  });

  function handleSend() {
    const content = messageInput.trim();
    if (!content || !activeConvId || sendMessage.isPending) return;
    setMessageInput("");
    sendMessage.mutate(content, {
      onSettled: () => {
        setTimeout(() => inputRef.current?.focus(), 0);
      },
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function selectConv(id: number) {
    setActiveConvId(id);
    setMobileShowThread(true);
  }

  const filteredConvs = conversations.filter(conv => {
    if (!searchQuery) return true;
    const name = conv.type === "group"
      ? conv.name ?? ""
      : conv.members.find(m => m.id !== user?.id)?.name ?? "";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Group messages by date for separators
  function getDateKey(date: string | Date) {
    return new Date(date).toDateString();
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <LayoutShell chatLayout>
      <div className="flex h-[calc(100vh-4rem)] md:h-[calc(100vh-2rem)] -m-6 md:-m-8 overflow-hidden rounded-xl border border-border bg-background shadow-sm">

        {/* ── Conversation list ─────────────────────────────────────────── */}
        <div className={`flex flex-col border-r border-border bg-card w-full md:w-80 shrink-0 ${mobileShowThread ? "hidden md:flex" : "flex"}`}>
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-base">Messages</h2>
              <div className="flex items-center gap-1">
                {isAdmin && (
                  <NewGroupDialog
                    users={allUsers}
                    currentUserId={user?.id ?? 0}
                    onCreate={(name, memberIds) => createGroup.mutate({ name, memberIds })}
                  />
                )}
                <NewDirectMessageDialog
                  users={allUsers}
                  currentUserId={user?.id ?? 0}
                  onSelect={(uid) => startDm.mutate(uid)}
                />
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-sm"
                data-testid="input-search-conversations"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            {convsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredConvs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <MessageCircle className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground font-medium">No conversations yet</p>
                <p className="text-xs text-muted-foreground mt-1">Start a new message using the button above</p>
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {filteredConvs.map(conv => {
                  const isActive = conv.id === activeConvId;
                  const otherName = conv.type === "group"
                    ? conv.name ?? "Group"
                    : conv.members.find(m => m.id !== user?.id)?.name ?? "Unknown";
                  return (
                    <button
                      key={conv.id}
                      onClick={() => selectConv(conv.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                        isActive ? "bg-accent" : "hover:bg-accent/50"
                      }`}
                      data-testid={`conversation-item-${conv.id}`}
                    >
                      <ConversationAvatar conv={conv} currentUserId={user?.id ?? 0} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{otherName}</span>
                          {conv.lastMessage && (
                            <span className="text-[11px] text-muted-foreground shrink-0">
                              {formatTime(conv.lastMessage.createdAt)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground truncate">
                            {conv.lastMessage
                              ? (conv.lastMessage.senderName === user?.name ? "You: " : "") + conv.lastMessage.content
                              : "No messages yet"}
                          </span>
                          {conv.unreadCount > 0 && (
                            <Badge className="h-5 min-w-5 flex items-center justify-center rounded-full text-[11px] px-1.5 bg-primary text-primary-foreground shrink-0">
                              {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* ── Message thread ─────────────────────────────────────────────── */}
        <div className={`flex flex-col flex-1 ${mobileShowThread ? "flex" : "hidden md:flex"}`}>
          {!activeConvId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <MessageCircle className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Your messages</h3>
              <p className="text-sm text-muted-foreground">Select a conversation or start a new one</p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-8 w-8"
                  onClick={() => setMobileShowThread(false)}
                  data-testid="button-back-to-list"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                {activeConv && (
                  <ConversationAvatar conv={activeConv} currentUserId={user?.id ?? 0} />
                )}
                <div className="flex-1 min-w-0">
                  {activeConv && (
                    <>
                      <p className="font-semibold text-sm truncate">
                        <ConversationName conv={activeConv} currentUserId={user?.id ?? 0} />
                      </p>
                      {activeConv.type === "group" && (
                        <p className="text-xs text-muted-foreground">
                          {activeConv.members.length} members
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Messages area */}
              <ScrollArea className="flex-1 px-4 py-4">
                {msgsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                    <MessageCircle className="h-8 w-8 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">No messages yet. Say hello!</p>
                  </div>
                ) : (
                  <div className="space-y-1 pb-2">
                    {messages.map((msg, i) => {
                      const isMine = msg.senderId === user?.id;
                      const prevMsg = messages[i - 1];
                      const showDateSep = !prevMsg || getDateKey(msg.createdAt) !== getDateKey(prevMsg.createdAt);
                      const showSender = !prevMsg || prevMsg.senderId !== msg.senderId || showDateSep;

                      return (
                        <div key={msg.id}>
                          {showDateSep && (
                            <div className="flex items-center gap-3 my-4">
                              <div className="flex-1 h-px bg-border" />
                              <span className="text-[11px] text-muted-foreground font-medium px-1">
                                {formatDateSeparator(msg.createdAt)}
                              </span>
                              <div className="flex-1 h-px bg-border" />
                            </div>
                          )}
                          <div className={showSender ? "mt-3" : "mt-0.5"}>
                            <MessageBubble
                              msg={msg}
                              isMine={isMine}
                              showSender={showSender}
                              isGroup={activeConv?.type === "group"}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Message input */}
              <div className="px-4 py-3 border-t border-border bg-card/50 shrink-0">
                <div className="flex items-center gap-2">
                  <Input
                    ref={inputRef}
                    placeholder="Type a message..."
                    value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1"
                    data-testid="input-message"
                    disabled={sendMessage.isPending}
                    autoFocus
                  />
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={!messageInput.trim() || sendMessage.isPending}
                    data-testid="button-send-message"
                  >
                    {sendMessage.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </LayoutShell>
  );
}
