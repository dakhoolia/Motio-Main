import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireRole } from "../middleware";
import { ROLE_NAMES, type User, type Role } from "@shared/schema";

type UserWithRole = User & { role: Role | null };
type BroadcastFn = (userIds: number[], data: unknown) => void;

const { ADMIN } = ROLE_NAMES;

export function createChatRouter(broadcastToUsers: BroadcastFn) {
  const router = Router();

  router.get("/", requireAuth, async (req, res) => {
    const convs = await storage.getConversations((req.user as User).id);
    res.json(convs);
  });

  router.post("/", requireAuth, async (req, res) => {
    const userId = (req.user as User).id;
    const body = z.discriminatedUnion("type", [
      z.object({ type: z.literal("direct"), userId: z.number() }),
      z.object({ type: z.literal("group"), name: z.string().min(1), memberIds: z.array(z.number()) }),
    ]).parse(req.body);

    if (body.type === "direct") {
      return res.json(await storage.getOrCreateDirectConversation(userId, body.userId));
    }

    const user = req.user as UserWithRole;
    if (!user.role || user.role.name !== ADMIN) {
      return res.status(403).json({ message: "Only admins can create group conversations" });
    }
    return res.json(await storage.createGroupConversation(body.name, userId, body.memberIds));
  });

  router.get("/:id", requireAuth, async (req, res) => {
    const userId = (req.user as User).id;
    const convId = Number(req.params.id);
    if (!(await storage.isConversationMember(convId, userId))) {
      return res.status(403).json({ message: "Not a member" });
    }
    const conv = await storage.getConversation(convId, userId);
    if (!conv) return res.status(404).json({ message: "Not found" });
    res.json(conv);
  });

  router.get("/:id/messages", requireAuth, async (req, res) => {
    const userId = (req.user as User).id;
    const convId = Number(req.params.id);
    if (!(await storage.isConversationMember(convId, userId))) {
      return res.status(403).json({ message: "Not a member" });
    }
    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    const before = req.query.before ? Number(req.query.before) : undefined;
    res.json(await storage.getMessages(convId, limit, before));
  });

  router.post("/:id/messages", requireAuth, async (req, res) => {
    const userId = (req.user as User).id;
    const convId = Number(req.params.id);
    if (!(await storage.isConversationMember(convId, userId))) {
      return res.status(403).json({ message: "Not a member" });
    }
    const { content } = z.object({ content: z.string().min(1).max(4000) }).parse(req.body);
    const msg = await storage.createMessage(convId, userId, content);
    const memberIds = await storage.getConversationMemberIds(convId);
    broadcastToUsers(memberIds, { type: "new_message", conversationId: convId, message: msg });
    res.json(msg);
  });

  router.post("/:id/read", requireAuth, async (req, res) => {
    const userId = (req.user as User).id;
    const convId = Number(req.params.id);
    if (!(await storage.isConversationMember(convId, userId))) {
      return res.status(403).json({ message: "Not a member" });
    }
    await storage.markConversationRead(convId, userId);
    res.json({ ok: true });
  });

  router.post("/:id/members", requireRole(ADMIN), async (req, res) => {
    const convId = Number(req.params.id);
    const { userId } = z.object({ userId: z.number() }).parse(req.body);
    await storage.addConversationMember(convId, userId);
    res.json({ ok: true });
  });

  router.delete("/:id/members/:userId", requireRole(ADMIN), async (req, res) => {
    await storage.removeConversationMember(Number(req.params.id), Number(req.params.userId));
    res.json({ ok: true });
  });

  return router;
}
