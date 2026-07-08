import { pgTable, text, serial, integer, boolean, timestamp, decimal, date, pgEnum, varchar, json, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const taskStatusEnum = pgEnum('task_status', ['Open', 'InProgress', 'Done']);
export const taskPriorityEnum = pgEnum('task_priority', ['Low', 'Medium', 'High']);
export const workOrderStatusEnum = pgEnum('work_order_status', ['Draft', 'Approved', 'InProgress', 'Done', 'Cancelled']);
export const inspectionResultEnum = pgEnum('inspection_result', ['Pending', 'Pass', 'Fail']);
export const expenseStatusEnum = pgEnum('expense_status', ['Submitted', 'Approved', 'Rejected', 'Paid']);

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  password: text("password").notNull(),
  roleId: integer("role_id").references(() => roles.id),
  isActive: boolean("is_active").default(true),
  mustChangePassword: boolean("must_change_password").default(true),
  avatarUrl: text("avatar_url"),
  totpSecret: text("totp_secret"), // encrypted at rest (enc:v1:… format)
  totpEnabled: boolean("totp_enabled").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vehicleStatuses = pgTable("vehicle_statuses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull(),
});

export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  stockNo: text("stock_no"),
  make: text("make").notNull(),
  model: text("model").notNull(),
  variant: text("variant"),
  year: integer("year").notNull(),
  regNo: text("reg_no").unique(),
  vin: text("vin"),
  color: text("color"),
  mileage: integer("mileage"),
  fuelType: text("fuel_type"),
  transmission: text("transmission"),
  bodyType: text("body_type"),
  driveType: text("drive_type"),
  engineSize: text("engine_size"),
  horsepower: integer("horsepower"),
  description: text("description"),
  source: text("source"),
  buyPrice: decimal("buy_price", { precision: 10, scale: 2 }),
  listPrice: decimal("list_price", { precision: 10, scale: 2 }),
  statusId: integer("status_id").references(() => vehicleStatuses.id),
  locationId: integer("location_id").references(() => locations.id),
  addedById: integer("added_by_id").references(() => users.id),
  acquiredAt: date("acquired_at"),
  finnCode: text("finn_code"),
  finnPublishedAt: timestamp("finn_published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").references(() => vehicles.id),
  url: text("url").notNull(),
  tag: text("tag"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").references(() => vehicles.id),
  regNo: text("reg_no"),
  title: text("title").notNull(),
  type: text("type"),
  status: taskStatusEnum("status").default('Open'),
  priority: taskPriorityEnum("priority").default('Medium'),
  dueAt: timestamp("due_at"),
  assigneeId: integer("assignee_id").references(() => users.id),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  type: text("type"),
});

export const workOrders = pgTable("work_orders", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").references(() => vehicles.id).notNull(),
  vendorId: integer("vendor_id").references(() => vendors.id).notNull(),
  type: text("type"),
  bookedAt: timestamp("booked_at"),
  estCost: decimal("est_cost", { precision: 10, scale: 2 }),
  finalCost: decimal("final_cost", { precision: 10, scale: 2 }),
  status: workOrderStatusEnum("status").default('Draft'),
  approvedById: integer("approved_by_id").references(() => users.id),
  findings: text("findings"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const inspections = pgTable("inspections", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").references(() => vehicles.id).notNull(),
  provider: text("provider").default('NAF'),
  bookedAt: timestamp("booked_at"),
  result: inspectionResultEnum("result").default('Pending'),
  reportUrl: text("report_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").references(() => vehicles.id),
  userId: integer("user_id").references(() => users.id).notNull(),
  purpose: text("purpose").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: expenseStatusEnum("status").default('Submitted'),
  docUrl: text("doc_url"),
  approvedById: integer("approved_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").references(() => vehicles.id).notNull().unique(),
  sellerId: integer("seller_id").references(() => users.id).notNull(),
  buyerName: text("buyer_name").notNull(),
  buyerPhone: text("buyer_phone"),
  deposit: decimal("deposit", { precision: 10, scale: 2 }),
  salePrice: decimal("sale_price", { precision: 10, scale: 2 }).notNull(),
  buyPrice: decimal("buy_price", { precision: 10, scale: 2 }),
  serviceCost: decimal("service_cost", { precision: 10, scale: 2 }).default('0'),
  soldAt: timestamp("sold_at").defaultNow(),
  deliveryAt: timestamp("delivery_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contractTemplates = pgTable("contract_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // "innkjøp" | "salg"
  content: text("content").notNull().default(""),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id),
});

export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").references(() => contractTemplates.id),
  vehicleId: integer("vehicle_id").references(() => vehicles.id),
  type: text("type").notNull(), // "innkjøp" | "salg"
  status: text("status").notNull().default("draft"), // "draft" | "pending" | "signed" | "cancelled"

  // Contract header info
  contactPerson: text("contact_person"),       // Kontaktperson at dealership
  handoverDate: text("handover_date"),          // Overtakelsesdato
  contractLocation: text("contract_location"), // Kontrakt inngått sted

  // Buyer/seller party info
  buyerName: text("buyer_name"),
  buyerEmail: text("buyer_email"),
  buyerPhone: text("buyer_phone"),
  buyerAddress: text("buyer_address"),
  buyerPostalCode: text("buyer_postal_code"),
  buyerCity: text("buyer_city"),
  buyerPersonNumber: text("buyer_person_number"),
  buyerSigned: boolean("buyer_signed").default(false),
  buyerSignedAt: timestamp("buyer_signed_at"),
  buyerBankIdRef: text("buyer_bank_id_ref"),

  sellerName: text("seller_name"),
  sellerEmail: text("seller_email"),
  sellerPhone: text("seller_phone"),
  sellerAddress: text("seller_address"),
  sellerPostalCode: text("seller_postal_code"),
  sellerCity: text("seller_city"),
  sellerPersonNumber: text("seller_person_number"),
  sellerSigned: boolean("seller_signed").default(false),
  sellerSignedAt: timestamp("seller_signed_at"),
  sellerBankIdRef: text("seller_bank_id_ref"),
  sellerAccountNo: text("seller_account_no"),  // Selgers kontonummer

  // Vehicle snapshot
  vehicleMake: text("vehicle_make"),
  vehicleModel: text("vehicle_model"),
  vehicleYear: integer("vehicle_year"),
  vehicleVin: text("vehicle_vin"),
  vehicleMileage: integer("vehicle_mileage"),
  vehicleColor: text("vehicle_color"),
  vehicleRegNo: text("vehicle_reg_no"),
  vehicleEquipment: text("vehicle_equipment"),
  vehicleTires: text("vehicle_tires"),
  vehiclePrice: decimal("vehicle_price", { precision: 12, scale: 2 }),
  vehicleFuelType: text("vehicle_fuel_type"),
  vehicleTransmission: text("vehicle_transmission"),
  vehicleBodyType: text("vehicle_body_type"),
  vehicleFirstRegistered: text("vehicle_first_registered"), // Først registrert
  vehicleKeys: integer("vehicle_keys"),                      // Nøkler, antall
  vehicleEuControlLast: text("vehicle_eu_control_last"),    // Sist EU kontroll
  vehicleEuControlNext: text("vehicle_eu_control_next"),    // Neste EU kontroll

  // Settlement / payment
  settlementAmount: decimal("settlement_amount", { precision: 12, scale: 2 }),

  notes: text("notes"),
  customTerms: text("custom_terms"),  // Editable kontraktvilkår
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: integer("entity_id"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Chat ────────────────────────────────────────────────────────────────────

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'direct' | 'group'
  name: text("name"),           // only for group conversations
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conversationMembers = pgTable("conversation_members", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  lastReadAt: timestamp("last_read_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, { fields: [users.roleId], references: [roles.id] }),
  tasks: many(tasks, { relationName: "tasks_assignee" }),
  sales: many(sales),
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  status: one(vehicleStatuses, { fields: [vehicles.statusId], references: [vehicleStatuses.id] }),
  location: one(locations, { fields: [vehicles.locationId], references: [locations.id] }),
  photos: many(photos),
  tasks: many(tasks),
  workOrders: many(workOrders),
  inspections: many(inspections),
  expenses: many(expenses),
  sale: one(sales),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  vehicle: one(vehicles, { fields: [tasks.vehicleId], references: [vehicles.id] }),
  assignee: one(users, { fields: [tasks.assigneeId], references: [users.id], relationName: "tasks_assignee" }),
  createdBy: one(users, { fields: [tasks.createdById], references: [users.id], relationName: "tasks_creator" }),
}));

// ── Session store (managed by connect-pg-simple — declared so drizzle-kit
//    push doesn't try to drop it) ──────────────────────────────────────────────

export const sessionTable = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
}, (table) => [
  index("IDX_session_expire").on(table.expire),
]);

// ── Dealership settings (single-tenant: one row) ─────────────────────────────

export const dealershipSettings = pgTable("dealership_settings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default("My Dealership"),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Insert schemas ────────────────────────────────────────────────────────────

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertVehicleSchema = createInsertSchema(vehicles).omit({ id: true, createdAt: true, updatedAt: true, finnCode: true, finnPublishedAt: true });
export const insertPhotoSchema = createInsertSchema(photos).omit({ id: true, createdAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true });
export const insertSaleSchema = createInsertSchema(sales).omit({ id: true, createdAt: true });
export const insertVendorSchema = createInsertSchema(vendors).omit({ id: true });
export const insertWorkOrderSchema = createInsertSchema(workOrders).omit({ id: true, createdAt: true });
export const insertInspectionSchema = createInsertSchema(inspections).omit({ id: true, createdAt: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertContractTemplateSchema = createInsertSchema(contractTemplates).omit({ id: true, createdAt: true });
export const insertContractSchema = createInsertSchema(contracts).omit({ id: true, createdAt: true });
export const insertDealershipSettingsSchema = createInsertSchema(dealershipSettings).omit({ id: true, createdAt: true, updatedAt: true });

// Password policy: min 12 chars, upper + lower + digit + symbol
export const passwordSchema = z
  .string()
  .min(12, "Passordet må ha minst 12 tegn")
  .regex(/[a-z]/, "Passordet må inneholde minst én liten bokstav")
  .regex(/[A-Z]/, "Passordet må inneholde minst én stor bokstav")
  .regex(/[0-9]/, "Passordet må inneholde minst ett tall")
  .regex(/[^a-zA-Z0-9]/, "Passordet må inneholde minst ett spesialtegn");

// ── Types ─────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Vehicle = typeof vehicles.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Sale = typeof sales.$inferSelect;
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Role = typeof roles.$inferSelect;
export type VehicleStatus = typeof vehicleStatuses.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type ConversationMember = typeof conversationMembers.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type ContractTemplate = typeof contractTemplates.$inferSelect;
export type InsertContractTemplate = z.infer<typeof insertContractTemplateSchema>;
export type Contract = typeof contracts.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;

export type DealershipSettings = typeof dealershipSettings.$inferSelect;
export type InsertDealershipSettings = z.infer<typeof insertDealershipSettingsSchema>;

export type ContractWithDetails = Contract & {
  template: ContractTemplate | null;
  createdByUser: { id: number; name: string } | null;
};

export type ChatMember = { id: number; name: string; firstName: string; lastName: string; avatarUrl?: string | null };

export type ConversationWithDetails = Conversation & {
  members: ChatMember[];
  lastMessage: (Message & { senderName: string }) | null;
  unreadCount: number;
};

export type MessageWithSender = Message & { sender: ChatMember };

export const ROLE_NAMES = {
  ADMIN: 'Admin',
  HYBRID: 'Hybrid',
  INNKJOPER: 'Innkjøper',
  SELGER: 'Selger',
  KLARGJORER: 'Klargjører',
} as const;

export type RoleName = typeof ROLE_NAMES[keyof typeof ROLE_NAMES];
