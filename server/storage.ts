import { db } from "./db";
import { 
  users, vehicles, tasks, sales, roles, vehicleStatuses, locations, auditLogs, photos,
  conversations, conversationMembers, messages,
  contractTemplates, contracts,
  type User, type InsertUser, type Vehicle, type InsertVehicle, type Photo,
  type Task, type InsertTask, type Sale, type InsertSale, type Role, type VehicleStatus, type Location,
  type AuditLog, type InsertAuditLog, type Conversation, type Message,
  type ChatMember, type ConversationWithDetails, type MessageWithSender,
  type ContractTemplate, type InsertContractTemplate, type Contract, type InsertContract, type ContractWithDetails,
  ROLE_NAMES
} from "@shared/schema";
import { eq, desc, sql, and, lt, inArray, ne } from "drizzle-orm";

export type { ChatMember, ConversationWithDetails, MessageWithSender };

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserWithRole(id: number): Promise<(User & { role: Role | null }) | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User>;
  getAllUsers(): Promise<(User & { role: Role | null })[]>;

  getRoles(): Promise<Role[]>;
  getVehicleStatuses(): Promise<VehicleStatus[]>;
  getLocations(): Promise<Location[]>;

  getVehicles(params: { statusId?: number; q?: string; page: number; limit: number }): Promise<{ data: (Vehicle & { status: VehicleStatus, location: Location | null, coverPhotoUrl: string | null })[]; total: number }>;
  getVehicle(id: number): Promise<(Vehicle & { status: VehicleStatus, location: Location | null, sale: Sale | null, photos: Photo[] }) | undefined>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: number, vehicle: Partial<InsertVehicle>): Promise<Vehicle>;
  getVehiclePhotos(vehicleId: number): Promise<Photo[]>;
  addVehiclePhoto(vehicleId: number, url: string, tag?: string): Promise<Photo>;
  deletePhoto(photoId: number): Promise<void>;
  getPublicVehicles(): Promise<(Vehicle & { status: VehicleStatus, location: Location | null, coverPhotoUrl: string | null })[]>;
  getPublicVehicle(id: number): Promise<(Vehicle & { status: VehicleStatus, location: Location | null, photos: Photo[] }) | undefined>;

  getTasks(params: { vehicleId?: number; assigneeId?: number; status?: string }): Promise<(Task & { vehicle: Vehicle | null, assignee: User | null })[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task>;
  
  getVehicleSuggestions(q: string): Promise<{ id: number; regNo: string; make: string; model: string }[]>;

  getSales(params: { days?: number }): Promise<(Sale & { vehicle: Vehicle & { intaker: { id: number; name: string } | null }, seller: User })[]>;
  createSale(sale: InsertSale): Promise<Sale>;
  updateSale(id: number, updates: Partial<InsertSale>): Promise<Sale>;

  getIntakeCounts(params: { days?: number }): Promise<{ userId: number; userName: string; count: number }[]>;

  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;

  // Chat
  getConversations(userId: number): Promise<ConversationWithDetails[]>;
  getConversation(id: number, userId: number): Promise<ConversationWithDetails | undefined>;
  getOrCreateDirectConversation(userId1: number, userId2: number): Promise<ConversationWithDetails>;
  createGroupConversation(name: string, createdById: number, memberIds: number[]): Promise<ConversationWithDetails>;
  getMessages(conversationId: number, limit?: number, before?: number): Promise<MessageWithSender[]>;
  createMessage(conversationId: number, senderId: number, content: string): Promise<MessageWithSender>;
  markConversationRead(conversationId: number, userId: number): Promise<void>;
  isConversationMember(conversationId: number, userId: number): Promise<boolean>;
  getConversationMemberIds(conversationId: number): Promise<number[]>;
  addConversationMember(conversationId: number, userId: number): Promise<void>;
  removeConversationMember(conversationId: number, userId: number): Promise<void>;

  seedMetadata(): Promise<void>;

  // Contract templates
  getContractTemplates(): Promise<ContractTemplate[]>;
  getContractTemplate(id: number): Promise<ContractTemplate | undefined>;
  createContractTemplate(template: InsertContractTemplate): Promise<ContractTemplate>;
  updateContractTemplate(id: number, updates: Partial<InsertContractTemplate>): Promise<ContractTemplate>;
  deleteContractTemplate(id: number): Promise<void>;

  // Contracts
  getContracts(params?: { type?: string; status?: string; createdBy?: number }): Promise<ContractWithDetails[]>;
  getContract(id: number): Promise<ContractWithDetails | undefined>;
  createContract(contract: InsertContract): Promise<Contract>;
  updateContract(id: number, updates: Partial<InsertContract>): Promise<Contract>;
  deleteContract(id: number): Promise<void>;
  signContract(id: number, party: "buyer" | "seller", bankIdRef: string): Promise<Contract>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserWithRole(id: number): Promise<(User & { role: Role | null }) | undefined> {
    const result = await db.select().from(users).leftJoin(roles, eq(users.roleId, roles.id)).where(eq(users.id, id));
    if (!result.length) return undefined;
    return { ...result[0].users, role: result[0].roles };
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User> {
    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return updated;
  }

  async getAllUsers(): Promise<(User & { role: Role | null })[]> {
    return await db.select().from(users).leftJoin(roles, eq(users.roleId, roles.id)).then(res => res.map(r => ({ ...r.users, role: r.roles })));
  }

  async getRoles(): Promise<Role[]> {
    return await db.select().from(roles);
  }

  async getVehicleStatuses(): Promise<VehicleStatus[]> {
    return await db.select().from(vehicleStatuses).orderBy(vehicleStatuses.sortOrder);
  }

  async getLocations(): Promise<Location[]> {
    return await db.select().from(locations);
  }

  async getVehicles({ statusId, q, page, limit }: { statusId?: number; q?: string; page: number; limit: number }): Promise<{ data: (Vehicle & { status: VehicleStatus, location: Location | null, coverPhotoUrl: string | null })[]; total: number }> {
    const offset = (page - 1) * limit;
    
    let conditions = [];
    if (statusId) conditions.push(eq(vehicles.statusId, statusId));
    if (q) conditions.push(sql`(${vehicles.make} ILIKE ${`%${q}%`} OR ${vehicles.model} ILIKE ${`%${q}%`} OR ${vehicles.regNo} ILIKE ${`%${q}%`} OR ${vehicles.color} ILIKE ${`%${q}%`})`);
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(vehicles).where(whereClause);
    const total = Number(countResult.count);

    const data = await db.select()
      .from(vehicles)
      .leftJoin(vehicleStatuses, eq(vehicles.statusId, vehicleStatuses.id))
      .leftJoin(locations, eq(vehicles.locationId, locations.id))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(vehicles.createdAt));

    const vehicleIds = data.map(d => d.vehicles.id);
    const coverPhotos = vehicleIds.length > 0 ? await db.select().from(photos).where(inArray(photos.vehicleId, vehicleIds)).orderBy(photos.id) : [];
    const coverMap = new Map<number, string>();
    for (const p of coverPhotos) { if (p.vehicleId && !coverMap.has(p.vehicleId)) coverMap.set(p.vehicleId, p.url); }
    
    return {
      data: data.map(d => ({ ...d.vehicles, status: d.vehicle_statuses!, location: d.locations, coverPhotoUrl: coverMap.get(d.vehicles.id) ?? null })),
      total
    };
  }

  async getVehicle(id: number): Promise<(Vehicle & { status: VehicleStatus, location: Location | null, sale: Sale | null, photos: Photo[] }) | undefined> {
    const result = await db.select()
      .from(vehicles)
      .leftJoin(vehicleStatuses, eq(vehicles.statusId, vehicleStatuses.id))
      .leftJoin(locations, eq(vehicles.locationId, locations.id))
      .leftJoin(sales, eq(sales.vehicleId, vehicles.id))
      .where(eq(vehicles.id, id));
    
    if (!result.length) return undefined;
    const d = result[0];
    const vehiclePhotos = await db.select().from(photos).where(eq(photos.vehicleId, id)).orderBy(photos.id);
    return { ...d.vehicles, status: d.vehicle_statuses!, location: d.locations, sale: d.sales, photos: vehiclePhotos };
  }

  async getVehiclePhotos(vehicleId: number): Promise<Photo[]> {
    return db.select().from(photos).where(eq(photos.vehicleId, vehicleId)).orderBy(photos.id);
  }

  async addVehiclePhoto(vehicleId: number, url: string, tag?: string): Promise<Photo> {
    const [photo] = await db.insert(photos).values({ vehicleId, url, tag: tag ?? null }).returning();
    return photo;
  }

  async deletePhoto(photoId: number): Promise<void> {
    await db.delete(photos).where(eq(photos.id, photoId));
  }

  async getPublicVehicles(): Promise<(Vehicle & { status: VehicleStatus, location: Location | null, coverPhotoUrl: string | null })[]> {
    const data = await db.select()
      .from(vehicles)
      .innerJoin(vehicleStatuses, eq(vehicles.statusId, vehicleStatuses.id))
      .leftJoin(locations, eq(vehicles.locationId, locations.id))
      .where(sql`${vehicleStatuses.name} IN ('Listed', 'Reserved')`)
      .orderBy(desc(vehicles.createdAt));

    const vehicleIds = data.map(d => d.vehicles.id);
    const coverPhotos = vehicleIds.length > 0 ? await db.select().from(photos).where(inArray(photos.vehicleId, vehicleIds)).orderBy(photos.id) : [];
    const coverMap = new Map<number, string>();
    for (const p of coverPhotos) { if (p.vehicleId && !coverMap.has(p.vehicleId)) coverMap.set(p.vehicleId, p.url); }

    return data.map(d => ({ ...d.vehicles, status: d.vehicle_statuses, location: d.locations, coverPhotoUrl: coverMap.get(d.vehicles.id) ?? null }));
  }

  async getPublicVehicle(id: number): Promise<(Vehicle & { status: VehicleStatus, location: Location | null, photos: Photo[] }) | undefined> {
    const result = await db.select()
      .from(vehicles)
      .innerJoin(vehicleStatuses, eq(vehicles.statusId, vehicleStatuses.id))
      .leftJoin(locations, eq(vehicles.locationId, locations.id))
      .where(and(eq(vehicles.id, id), sql`${vehicleStatuses.name} IN ('Listed', 'Reserved')`));

    if (!result.length) return undefined;
    const d = result[0];
    const vehiclePhotos = await db.select().from(photos).where(eq(photos.vehicleId, id)).orderBy(photos.id);
    return { ...d.vehicles, status: d.vehicle_statuses, location: d.locations, photos: vehiclePhotos };
  }

  async createVehicle(vehicle: InsertVehicle): Promise<Vehicle> {
    const [newVehicle] = await db.insert(vehicles).values(vehicle).returning();
    return newVehicle;
  }

  async updateVehicle(id: number, updates: Partial<InsertVehicle>): Promise<Vehicle> {
    const [updated] = await db.update(vehicles).set(updates).where(eq(vehicles.id, id)).returning();
    return updated;
  }

  async getTasks({ vehicleId, assigneeId, status }: { vehicleId?: number; assigneeId?: number; status?: string }): Promise<(Task & { vehicle: Vehicle | null, assignee: User | null })[]> {
    let conditions = [];
    if (vehicleId) conditions.push(eq(tasks.vehicleId, vehicleId));
    if (assigneeId) conditions.push(eq(tasks.assigneeId, assigneeId));
    if (status) conditions.push(eq(tasks.status, status as any));

    const result = await db.select()
      .from(tasks)
      .leftJoin(vehicles, eq(tasks.vehicleId, vehicles.id))
      .leftJoin(users, eq(tasks.assigneeId, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(tasks.createdAt));

    return result.map(r => ({ ...r.tasks, vehicle: r.vehicles, assignee: r.users }));
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values(task).returning();
    return newTask;
  }

  async updateTask(id: number, updates: Partial<InsertTask>): Promise<Task> {
    const [updated] = await db.update(tasks).set(updates).where(eq(tasks.id, id)).returning();
    return updated;
  }

  async getVehicleSuggestions(q: string): Promise<{ id: number; regNo: string; make: string; model: string }[]|any> {
    return await db.select({
      id: vehicles.id,
      regNo: vehicles.regNo,
      make: vehicles.make,
      model: vehicles.model,
    })
    .from(vehicles)
    .where(sql`${vehicles.regNo} ILIKE ${`%${q}%`}`)
    .limit(10);
  }

  async getSales(params: { days?: number }): Promise<(Sale & { vehicle: Vehicle & { intaker: { id: number; name: string } | null }, seller: User })[]> {
    let conditions = [];
    
    if (params.days) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - params.days);
      conditions.push(sql`${sales.soldAt} >= ${startDate}`);
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const data = await db.select()
      .from(sales)
      .innerJoin(vehicles, eq(sales.vehicleId, vehicles.id))
      .innerJoin(users, eq(sales.sellerId, users.id))
      .where(whereClause)
      .orderBy(desc(sales.soldAt));
    
    const results = [];
    for (const d of data) {
      let intaker: { id: number; name: string } | null = null;
      if (d.vehicles.addedById) {
        const [intakerUser] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, d.vehicles.addedById));
        if (intakerUser) intaker = intakerUser;
      }
      results.push({
        ...d.sales,
        vehicle: { ...d.vehicles, intaker },
        seller: d.users,
      });
    }
    
    return results;
  }

  async createSale(sale: InsertSale): Promise<Sale> {
    const [newSale] = await db.insert(sales).values(sale).returning();
    return newSale;
  }

  async updateSale(id: number, updates: Partial<InsertSale>): Promise<Sale> {
    const [updated] = await db.update(sales).set(updates).where(eq(sales.id, id)).returning();
    return updated;
  }

  async getIntakeCounts(params: { days?: number }): Promise<{ userId: number; userName: string; count: number }[]> {
    let conditions = [sql`${vehicles.addedById} IS NOT NULL`];
    
    if (params.days) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - params.days);
      conditions.push(sql`${vehicles.createdAt} >= ${startDate}`);
    }
    
    const whereClause = and(...conditions);
    
    const data = await db.select({
      userId: vehicles.addedById,
      userName: users.name,
      count: sql<number>`count(*)::int`,
    })
      .from(vehicles)
      .innerJoin(users, eq(vehicles.addedById, users.id))
      .where(whereClause)
      .groupBy(vehicles.addedById, users.name);
    
    return data.map(d => ({
      userId: d.userId!,
      userName: d.userName,
      count: d.count,
    }));
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLogs).values(log).returning();
    return newLog;
  }

  // ── Chat ──────────────────────────────────────────────────────────────────

  private async buildConversationDetails(convs: Conversation[], userId: number): Promise<ConversationWithDetails[]> {
    const results: ConversationWithDetails[] = [];
    for (const conv of convs) {
      const memberRows = await db
        .select({ id: users.id, name: users.name, firstName: users.firstName, lastName: users.lastName, avatarUrl: users.avatarUrl })
        .from(conversationMembers)
        .innerJoin(users, eq(conversationMembers.userId, users.id))
        .where(eq(conversationMembers.conversationId, conv.id));

      const [lastMsgRow] = await db
        .select({ msg: messages, senderName: users.name })
        .from(messages)
        .innerJoin(users, eq(messages.senderId, users.id))
        .where(eq(messages.conversationId, conv.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      const [memberRow] = await db
        .select({ lastReadAt: conversationMembers.lastReadAt })
        .from(conversationMembers)
        .where(and(eq(conversationMembers.conversationId, conv.id), eq(conversationMembers.userId, userId)));

      let unreadCount = 0;
      if (memberRow) {
        const lastRead = memberRow.lastReadAt;
        const [countRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(messages)
          .where(and(
            eq(messages.conversationId, conv.id),
            ne(messages.senderId, userId),
            lastRead ? sql`${messages.createdAt} > ${lastRead}` : sql`true`
          ));
        unreadCount = countRow?.count ?? 0;
      }

      results.push({
        ...conv,
        members: memberRows,
        lastMessage: lastMsgRow ? { ...lastMsgRow.msg, senderName: lastMsgRow.senderName } : null,
        unreadCount,
      });
    }
    return results;
  }

  async getConversations(userId: number): Promise<ConversationWithDetails[]> {
    const memberOfConvIds = await db
      .select({ conversationId: conversationMembers.conversationId })
      .from(conversationMembers)
      .where(eq(conversationMembers.userId, userId));

    if (!memberOfConvIds.length) return [];

    const ids = memberOfConvIds.map(r => r.conversationId);
    const convs = await db
      .select()
      .from(conversations)
      .where(inArray(conversations.id, ids))
      .orderBy(desc(conversations.createdAt));

    const details = await this.buildConversationDetails(convs, userId);

    // Sort by last message time descending
    return details.sort((a, b) => {
      const timeA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : new Date(a.createdAt).getTime();
      const timeB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : new Date(b.createdAt).getTime();
      return timeB - timeA;
    });
  }

  async getConversation(id: number, userId: number): Promise<ConversationWithDetails | undefined> {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    if (!conv) return undefined;
    const [details] = await this.buildConversationDetails([conv], userId);
    return details;
  }

  async getOrCreateDirectConversation(userId1: number, userId2: number): Promise<ConversationWithDetails> {
    // Find existing direct conversation between both users
    const existing = await db
      .select({ conversationId: conversationMembers.conversationId })
      .from(conversationMembers)
      .where(eq(conversationMembers.userId, userId1));

    for (const row of existing) {
      const [conv] = await db.select().from(conversations)
        .where(and(eq(conversations.id, row.conversationId), eq(conversations.type, 'direct')));
      if (!conv) continue;
      const isMember = await this.isConversationMember(conv.id, userId2);
      if (isMember) {
        const [details] = await this.buildConversationDetails([conv], userId1);
        return details;
      }
    }

    // Create new direct conversation
    const [conv] = await db.insert(conversations).values({ type: 'direct', createdById: userId1 }).returning();
    await db.insert(conversationMembers).values([
      { conversationId: conv.id, userId: userId1 },
      { conversationId: conv.id, userId: userId2 },
    ]);

    const [details] = await this.buildConversationDetails([conv], userId1);
    return details;
  }

  async createGroupConversation(name: string, createdById: number, memberIds: number[]): Promise<ConversationWithDetails> {
    const [conv] = await db.insert(conversations).values({ type: 'group', name, createdById }).returning();
    const allMembers = Array.from(new Set([createdById, ...memberIds]));
    await db.insert(conversationMembers).values(allMembers.map(uid => ({ conversationId: conv.id, userId: uid })));
    const [details] = await this.buildConversationDetails([conv], createdById);
    return details;
  }

  async getMessages(conversationId: number, limit = 50, before?: number): Promise<MessageWithSender[]> {
    let conditions = [eq(messages.conversationId, conversationId)];
    if (before) {
      const [beforeMsg] = await db.select().from(messages).where(eq(messages.id, before));
      if (beforeMsg) conditions.push(lt(messages.createdAt, beforeMsg.createdAt));
    }

    const rows = await db
      .select({ msg: messages, sender: { id: users.id, name: users.name, firstName: users.firstName, lastName: users.lastName, avatarUrl: users.avatarUrl } })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    return rows.map(r => ({ ...r.msg, sender: r.sender })).reverse();
  }

  async createMessage(conversationId: number, senderId: number, content: string): Promise<MessageWithSender> {
    const [msg] = await db.insert(messages).values({ conversationId, senderId, content }).returning();
    const [sender] = await db
      .select({ id: users.id, name: users.name, firstName: users.firstName, lastName: users.lastName, avatarUrl: users.avatarUrl })
      .from(users).where(eq(users.id, senderId));
    // Update sender's lastReadAt
    await db.update(conversationMembers)
      .set({ lastReadAt: new Date() })
      .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, senderId)));
    return { ...msg, sender };
  }

  async markConversationRead(conversationId: number, userId: number): Promise<void> {
    await db.update(conversationMembers)
      .set({ lastReadAt: new Date() })
      .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
  }

  async isConversationMember(conversationId: number, userId: number): Promise<boolean> {
    const [row] = await db.select().from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
    return !!row;
  }

  async getConversationMemberIds(conversationId: number): Promise<number[]> {
    const rows = await db.select({ userId: conversationMembers.userId })
      .from(conversationMembers).where(eq(conversationMembers.conversationId, conversationId));
    return rows.map(r => r.userId);
  }

  async addConversationMember(conversationId: number, userId: number): Promise<void> {
    await db.insert(conversationMembers).values({ conversationId, userId }).onConflictDoNothing();
  }

  async removeConversationMember(conversationId: number, userId: number): Promise<void> {
    await db.delete(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
  }

  // ── Contract Templates ────────────────────────────────────────────────────

  async getContractTemplates(): Promise<ContractTemplate[]> {
    return db.select().from(contractTemplates).orderBy(desc(contractTemplates.createdAt));
  }

  async getContractTemplate(id: number): Promise<ContractTemplate | undefined> {
    const [t] = await db.select().from(contractTemplates).where(eq(contractTemplates.id, id));
    return t;
  }

  async createContractTemplate(template: InsertContractTemplate): Promise<ContractTemplate> {
    const [t] = await db.insert(contractTemplates).values(template).returning();
    return t;
  }

  async updateContractTemplate(id: number, updates: Partial<InsertContractTemplate>): Promise<ContractTemplate> {
    const [t] = await db.update(contractTemplates).set(updates).where(eq(contractTemplates.id, id)).returning();
    return t;
  }

  async deleteContractTemplate(id: number): Promise<void> {
    await db.delete(contractTemplates).where(eq(contractTemplates.id, id));
  }

  // ── Contracts ─────────────────────────────────────────────────────────────

  async getContracts(params?: { type?: string; status?: string; createdBy?: number }): Promise<ContractWithDetails[]> {
    const rows = await db.select({
      contract: contracts,
      template: contractTemplates,
      creator: { id: users.id, name: users.name },
    })
      .from(contracts)
      .leftJoin(contractTemplates, eq(contracts.templateId, contractTemplates.id))
      .leftJoin(users, eq(contracts.createdBy, users.id))
      .orderBy(desc(contracts.createdAt));

    let filtered = rows;
    if (params?.type) filtered = filtered.filter(r => r.contract.type === params.type);
    if (params?.status) filtered = filtered.filter(r => r.contract.status === params.status);
    if (params?.createdBy) filtered = filtered.filter(r => r.contract.createdBy === params.createdBy);

    return filtered.map(r => ({
      ...r.contract,
      template: r.template ?? null,
      createdByUser: r.creator?.id ? r.creator : null,
    }));
  }

  async getContract(id: number): Promise<ContractWithDetails | undefined> {
    const rows = await db.select({
      contract: contracts,
      template: contractTemplates,
      creator: { id: users.id, name: users.name },
    })
      .from(contracts)
      .leftJoin(contractTemplates, eq(contracts.templateId, contractTemplates.id))
      .leftJoin(users, eq(contracts.createdBy, users.id))
      .where(eq(contracts.id, id));

    if (!rows.length) return undefined;
    const r = rows[0];
    return {
      ...r.contract,
      template: r.template ?? null,
      createdByUser: r.creator?.id ? r.creator : null,
    };
  }

  async createContract(contract: InsertContract): Promise<Contract> {
    const [c] = await db.insert(contracts).values(contract).returning();
    return c;
  }

  async updateContract(id: number, updates: Partial<InsertContract>): Promise<Contract> {
    const [c] = await db.update(contracts).set(updates).where(eq(contracts.id, id)).returning();
    return c;
  }

  async deleteContract(id: number): Promise<void> {
    await db.delete(contracts).where(eq(contracts.id, id));
  }

  async signContract(id: number, party: "buyer" | "seller", bankIdRef: string): Promise<Contract> {
    const now = new Date();
    const updates = party === "buyer"
      ? { buyerSigned: true, buyerSignedAt: now, buyerBankIdRef: bankIdRef }
      : { sellerSigned: true, sellerSignedAt: now, sellerBankIdRef: bankIdRef };

    // Check if both will be signed after this update
    const existing = await this.getContract(id);
    const otherSigned = party === "buyer" ? existing?.sellerSigned : existing?.buyerSigned;
    const finalUpdates = otherSigned
      ? { ...updates, status: "signed" as const }
      : updates;

    const [c] = await db.update(contracts).set(finalUpdates).where(eq(contracts.id, id)).returning();
    return c;
  }

  async seedMetadata(): Promise<void> {
    const existingRoles = await this.getRoles();
    const requiredRoles = [ROLE_NAMES.ADMIN, ROLE_NAMES.HYBRID, ROLE_NAMES.INNKJOPER, ROLE_NAMES.SELGER, ROLE_NAMES.KLARGJORER];
    
    for (const roleName of requiredRoles) {
      if (!existingRoles.find(r => r.name === roleName)) {
        await db.insert(roles).values({ name: roleName }).onConflictDoNothing();
      }
    }

    const existingStatuses = await this.getVehicleStatuses();
    if (existingStatuses.length === 0) {
      await db.insert(vehicleStatuses).values([
        { name: 'Intake', sortOrder: 1 },
        { name: 'Klargjøring', sortOrder: 2 },
        { name: 'NAF', sortOrder: 3 },
        { name: 'Listed', sortOrder: 4 },
        { name: 'Reserved', sortOrder: 5 },
        { name: 'Sold', sortOrder: 6 },
        { name: 'Delivered', sortOrder: 7 },
      ]);
    }

    const existingLocations = await this.getLocations();
    if (existingLocations.length === 0) {
      await db.insert(locations).values([
        { name: 'Showroom A' },
        { name: 'Lot B' },
        { name: 'Workshop' },
      ]);
    }
  }
}

export const storage = new DatabaseStorage();
