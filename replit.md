# Motio - Car Dealership Logistics Web App

## Overview

Motio is a production-lean logistics web application for car dealerships that replaces Excel-based workflows. It manages vehicle intake, preparation tasks, inspections, issues/claims, and employee expenses through a modern full-stack architecture.

The application follows a monorepo structure with a React frontend (Vite + TypeScript) and Express.js backend, using PostgreSQL with Drizzle ORM for data persistence. It implements session-based authentication with Passport.js and provides a comprehensive REST API with Swagger documentation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, bundled via Vite
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state caching and synchronization
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming
- **Form Handling**: React Hook Form with Zod validation schemas

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful endpoints with typed route definitions in `shared/routes.ts`
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Authentication**: Passport.js with local strategy, session-based auth using express-session
- **Password Security**: scrypt-based hashing with timing-safe comparison
- **API Documentation**: Swagger UI served at `/api/doc`

### Data Storage
- **Database**: PostgreSQL (configured via `DATABASE_URL` environment variable)
- **Schema Location**: `shared/schema.ts` defines all tables using Drizzle's pgTable
- **Migrations**: Drizzle Kit for schema migrations (`drizzle-kit push`)
- **Session Store**: Memory store for development (should use connect-pg-simple for production)

### Key Design Patterns
- **Shared Types**: Schema definitions and route types are shared between client and server via `@shared/*` path alias
- **Storage Abstraction**: `server/storage.ts` implements IStorage interface for database operations
- **API Type Safety**: Zod schemas define request/response types with runtime validation
- **Component Composition**: Reusable UI components with consistent styling via CVA (class-variance-authority)

### Core Domain Models
1. **Roles** - User permission levels (Admin, Hybrid, Innkjøper, Selger, Klargjører)
2. **Users** - System users with role-based access, forced password change on first login
3. **VehicleStatuses** - Workflow stages (Intake, Klargjøring, NAF, Listed, Reserved, Sold, Delivered)
4. **Locations** - Physical locations for vehicle tracking
5. **Vehicles** - Core inventory with make, model, pricing, status
6. **Tasks** - Work items assignable to users with priority and status; auto-created when vehicle enters Klargjøring status
7. **Sales** - Sale records linking vehicles to sale data
8. **Vendors, WorkOrders, Inspections, Expenses** - Extended domain entities

### Role-Based Access
- **Navigation**: All pages visible to all users; only "Users" admin page restricted to Admin role
- **Data Modifications**: Role-based restrictions on what changes users can make:
  - Admin/Hybrid: Full access to all features
  - Innkjøper: Can create/edit vehicles they added
  - Selger: Can mark vehicles as sold
  - Klargjører: Can only update vehicle status (prep-related) and manage tasks
- **Auto-task**: When a vehicle status changes to "Klargjøring", a task is automatically created linking to that vehicle

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and schema management

### Authentication & Security
- **Passport.js**: Authentication middleware with local strategy
- **express-session**: Session management (14-day cookie expiry)
- **scrypt**: Native Node.js crypto for password hashing

### API Documentation
- **swagger-ui-express**: Serves interactive API documentation
- **yamljs**: Parses Swagger specification from `server/swagger.yaml`

### Frontend Libraries
- **@tanstack/react-query**: Server state management and caching
- **date-fns**: Date formatting and manipulation
- **Radix UI**: Accessible UI component primitives (dialog, select, tabs, etc.)
- **Lucide React**: Icon library

### Build & Development
- **Vite**: Frontend build tool with HMR
- **esbuild**: Server bundling for production
- **tsx**: TypeScript execution for development
- **Tailwind CSS**: Utility-first CSS framework