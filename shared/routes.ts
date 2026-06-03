import { z } from 'zod';
import { 
  insertUserSchema, insertVehicleSchema, insertTaskSchema, insertSaleSchema,
  insertVendorSchema, insertWorkOrderSchema, insertInspectionSchema, insertExpenseSchema,
  users, vehicles, tasks, sales, vendors, workOrders, inspections, expenses, roles, vehicleStatuses, locations
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  })
};

export const api = {
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/auth/login',
      input: z.object({
        username: z.string(),
        password: z.string(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout',
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/user',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    }
  },
  vehicles: {
    list: {
      method: 'GET' as const,
      path: '/api/vehicles',
      input: z.object({
        statusId: z.coerce.number().optional(),
        q: z.string().optional(),
        page: z.coerce.number().default(1),
        limit: z.coerce.number().default(10),
      }).optional(),
      responses: {
        200: z.object({
          data: z.array(z.custom<typeof vehicles.$inferSelect & { 
            status: typeof vehicleStatuses.$inferSelect,
            location: typeof locations.$inferSelect | null 
          }>()),
          total: z.number(),
          page: z.number(),
          limit: z.number(),
        }),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/vehicles/:id',
      responses: {
        200: z.custom<typeof vehicles.$inferSelect & {
          status: typeof vehicleStatuses.$inferSelect,
          location: typeof locations.$inferSelect | null,
          tasks: typeof tasks.$inferSelect[],
          sale: typeof sales.$inferSelect | null,
        }>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/vehicles',
      input: insertVehicleSchema,
      responses: {
        201: z.custom<typeof vehicles.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/vehicles/:id',
      input: insertVehicleSchema.partial(),
      responses: {
        200: z.custom<typeof vehicles.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    suggestions: {
      method: 'GET' as const,
      path: '/api/vehicles/suggestions',
      input: z.object({
        q: z.string(),
      }),
      responses: {
        200: z.array(z.object({
          id: z.number(),
          regNo: z.string(),
          make: z.string(),
          model: z.string(),
        })),
      },
    },
  },
  tasks: {
    list: {
      method: 'GET' as const,
      path: '/api/tasks',
      input: z.object({
        vehicleId: z.coerce.number().optional(),
        assigneeId: z.coerce.number().optional(),
        status: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof tasks.$inferSelect & {
          vehicle: typeof vehicles.$inferSelect | null,
          assignee: typeof users.$inferSelect | null
        }>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/tasks',
      input: insertTaskSchema,
      responses: {
        201: z.custom<typeof tasks.$inferSelect>(),
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/tasks/:id',
      input: insertTaskSchema.partial(),
      responses: {
        200: z.custom<typeof tasks.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  sales: {
    list: {
      method: 'GET' as const,
      path: '/api/sales',
      input: z.object({
        days: z.coerce.number().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof sales.$inferSelect & {
          vehicle: typeof vehicles.$inferSelect,
          seller: typeof users.$inferSelect,
        }>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/sales',
      input: insertSaleSchema,
      responses: {
        201: z.custom<typeof sales.$inferSelect>(),
      },
    },
  },
  metadata: {
    statuses: {
      method: 'GET' as const,
      path: '/api/statuses',
      responses: {
        200: z.array(z.custom<typeof vehicleStatuses.$inferSelect>()),
      },
    },
    locations: {
      method: 'GET' as const,
      path: '/api/locations',
      responses: {
        200: z.array(z.custom<typeof locations.$inferSelect>()),
      },
    },
    roles: {
      method: 'GET' as const,
      path: '/api/roles',
      responses: {
        200: z.array(z.custom<typeof roles.$inferSelect>()),
      },
    },
    users: {
      method: 'GET' as const,
      path: '/api/users',
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect & { role: typeof roles.$inferSelect | null }>()),
      },
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
