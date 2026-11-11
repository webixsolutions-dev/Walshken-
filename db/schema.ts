import { bigint, integer, pgTable, text, check, uniqueIndex, index, customType } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const key = () => text("id").primaryKey().notNull();
const stamp = (name = "created_at") => text(name).notNull().default(sql`(to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))`);

export const organizations = pgTable("organizations", {
  id: key(), name: text("name").notNull(), timeZone: text("time_zone").notNull().default("America/Edmonton"),
});
export const units = pgTable("units", {
  id: key(), orgId: text("org_id").notNull().references(() => organizations.id),
  kind: text("kind").notNull(), name: text("name").notNull(), country: text("country"), region: text("region"), timeZone: text("time_zone"),
}, (t) => [uniqueIndex("unit_name_unique").on(t.orgId, t.kind, t.name)]);
export const employees = pgTable("employees", {
  id: key(), orgId: text("org_id").notNull().references(() => organizations.id),
  authId: text("auth_id").unique(), employeeNo: text("employee_no").notNull(), name: text("name").notNull(), email: text("email").notNull().unique(),
  role: text("role").notNull(), status: text("status").notNull().default("Active"), title: text("title").notNull().default(""),
  departmentId: text("department_id").references(() => units.id), divisionId: text("division_id").references(() => units.id),
  officeId: text("office_id").references(() => units.id), managerId: text("manager_id"),
  country: text("country").notNull().default("CA"), jurisdiction: text("jurisdiction").notNull().default("CA-AB"),
  timeZone: text("time_zone").notNull().default("America/Edmonton"), employmentType: text("employment_type").notNull().default("Full-time"),
  hireDate: text("hire_date"), contractStart: text("contract_start"), employmentEnd: text("employment_end"), phone: text("phone"),
  expectedHours: integer("expected_hours").notNull().default(40), breakPolicy: text("break_policy").notNull().default("unpaid"),
  leaveDays: integer("leave_days"), createdAt: stamp(), activatedAt: text("activated_at"), lastLoginAt: text("last_login_at"),
}, (t) => [uniqueIndex("org_employee_no_unique").on(t.orgId, t.employeeNo), index("employee_manager_idx").on(t.orgId, t.managerId)]);
export const sessions = pgTable("sessions", {
  id: key(), employeeId: text("employee_id").notNull().references(() => employees.id),
  createdAt: stamp(), expiresAt: text("expires_at").notNull(), endedAt: text("ended_at"), agent: text("agent").notNull(),
}, (t) => [index("employee_sessions_idx").on(t.employeeId, t.expiresAt)]);
export const audit = pgTable("audit", {
  id: key(), orgId: text("org_id").notNull().references(() => organizations.id), actorId: text("actor_id"),
  action: text("action").notNull(), entity: text("entity").notNull(), targetId: text("target_id"), createdAt: stamp(),
}, (t) => [index("audit_by_org_time").on(t.orgId, t.createdAt)]);

export const markets = pgTable("markets", {
  code: text("code").primaryKey().notNull(), enabled: integer("enabled").notNull().default(0),
  contact: text("contact").notNull().default(""),
});
export const services = pgTable("services", {
  id: key(), name: text("name").notNull(), description: text("description").notNull(), icon: text("icon").notNull(),
  sort: integer("sort").notNull().default(0), archived: integer("archived").notNull().default(0),
});
export const availability = pgTable("availability", {
  id: key(), country: text("country").notNull().references(() => markets.code),
  serviceId: text("service_id").notNull().references(() => services.id), enabled: integer("enabled").notNull().default(0),
  destination: text("destination").notNull().default(""),
}, (t) => [uniqueIndex("service_market_unique").on(t.country, t.serviceId)]);
export const siteContent = pgTable("site_content", { id: key(), title: text("title").notNull(), description: text("description").notNull(), about: text("about").notNull() });
export const customers = pgTable("customers", {
  id: key(), name: text("name").notNull(), email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(), createdAt: stamp(),
});
export const customerSessions = pgTable("customer_sessions", {
  id: key(), customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
}, (t) => [index("customer_sessions_account_idx").on(t.customerId, t.expiresAt)]);
export const inquiries = pgTable("inquiries", {
  id: key(), kind: text("kind").notNull(), name: text("name"), email: text("email").notNull(),
  country: text("country").notNull(), service: text("service"), message: text("message"), createdAt: stamp(),
  customerId: text("customer_id").references(() => customers.id),
  status: text("status").notNull().default("Received"), customerUpdate: text("customer_update"), updatedAt: text("updated_at"),
}, (t) => [
  index("inquiry_email_time").on(t.email, t.createdAt),
  index("inquiry_customer_time").on(t.customerId, t.createdAt, t.id),
  check("inquiry_status_check", sql`${t.status} in ('Received', 'In review', 'Resolved')`),
]);
export const rateLimits = pgTable("rate_limits", { id: key(), hits: integer("hits").notNull(), expiresAt: bigint("expires_at", {mode:"number"}).notNull() });

export const projects = pgTable("projects", {
  id: key(), orgId: text("org_id").notNull().references(() => organizations.id), ownerId: text("owner_id").notNull().references(() => employees.id),
  departmentId: text("department_id").references(() => units.id), name: text("name").notNull(),
  description: text("description").notNull(), status: text("status").notNull().default("Active"), createdAt: stamp(),
});
export const tasks = pgTable("tasks", {
  id: key(), orgId: text("org_id").notNull().references(() => organizations.id), employeeId: text("employee_id").notNull().references(() => employees.id),
  assignedBy: text("assigned_by").notNull().references(() => employees.id), projectId: text("project_id").references(() => projects.id),
  title: text("title").notNull(), description: text("description").notNull(), priority: text("priority").notNull(),
  status: text("status").notNull().default("Not Started"), startDate: text("start_date"), dueDate: text("due_date"),
  estimateMinutes: integer("estimate_minutes").notNull().default(0), actualMinutes: integer("actual_minutes").notNull().default(0),
  completedAt: text("completed_at"), createdAt: stamp(),
}, (t) => [index("task_assignee_idx").on(t.orgId, t.employeeId, t.dueDate)]);
export const taskComments = pgTable("task_comments", {
  id: key(), taskId: text("task_id").notNull().references(() => tasks.id), authorId: text("author_id").notNull().references(() => employees.id),
  body: text("body").notNull(), createdAt: stamp(),
});

export const shifts = pgTable("shifts", {
  id: key(), orgId: text("org_id").notNull().references(() => organizations.id), employeeId: text("employee_id").notNull().references(() => employees.id),
  startsAt: text("starts_at").notNull(), endsAt: text("ends_at").notNull(), title: text("title").notNull(),
  location: text("location").notNull(), createdBy: text("created_by").notNull(), published: integer("published").notNull().default(1),
}, (t) => [index("shift_employee_start").on(t.employeeId, t.startsAt)]);
export const attendance = pgTable("attendance", {
  id: key(), orgId: text("org_id").notNull().references(() => organizations.id), employeeId: text("employee_id").notNull().references(() => employees.id),
  startsAt: text("starts_at").notNull(), endsAt: text("ends_at"), timeZone: text("time_zone").notNull(),
}, (t) => [
  uniqueIndex("one_open_attendance").on(t.employeeId).where(sql`ends_at IS NULL`),
  index("attendance_employee_start").on(t.employeeId, t.startsAt),
]);
export const breaks = pgTable("breaks", {
  id: key(), attendanceId: text("attendance_id").notNull().references(() => attendance.id),
  startsAt: text("starts_at").notNull(), endsAt: text("ends_at"), paid: integer("paid").notNull().default(0),
}, (t) => [uniqueIndex("one_open_break").on(t.attendanceId).where(sql`ends_at IS NULL`)]);
export const timesheets = pgTable("timesheets", {
  id: key(), attendanceId: text("attendance_id").references(() => attendance.id).unique(), orgId: text("org_id").notNull().references(() => organizations.id),
  employeeId: text("employee_id").notNull().references(() => employees.id), workDate: text("work_date").notNull(),
  grossSeconds: integer("gross_seconds").notNull(), unpaidSeconds: integer("unpaid_seconds").notNull(), paidSeconds: integer("paid_seconds").notNull(),
  status: text("status").notNull().default("Draft"), note: text("note"), reviewerId: text("reviewer_id"), reviewedAt: text("reviewed_at"), createdAt: stamp(),
}, (t) => [index("timesheets_employee_date").on(t.employeeId, t.workDate)]);
export const corrections = pgTable("corrections", {
  id: key(), attendanceId: text("attendance_id").references(() => attendance.id), employeeId: text("employee_id").notNull().references(() => employees.id),
  note: text("note").notNull(), status: text("status").notNull().default("Pending"), reviewedAt: text("reviewed_at"), reviewerId: text("reviewer_id"), createdAt: stamp(),
});
export const leave = pgTable("leave_requests", {
  id: key(), orgId: text("org_id").notNull().references(() => organizations.id), employeeId: text("employee_id").notNull().references(() => employees.id),
  category: text("category").notNull(), startsOn: text("starts_on").notNull(), endsOn: text("ends_on").notNull(),
  status: text("status").notNull().default("Pending"), note: text("note"), reviewerId: text("reviewer_id"), createdAt: stamp(),
});

export const conversations = pgTable("conversations", {
  id: key(), orgId: text("org_id").notNull().references(() => organizations.id), title: text("title").notNull(), kind: text("kind").notNull(),
  createdBy: text("created_by").notNull().references(() => employees.id), createdAt: stamp(),
});
export const members = pgTable("conversation_members", {
  id: key(), conversationId: text("conversation_id").notNull().references(() => conversations.id),
  employeeId: text("employee_id").notNull().references(() => employees.id), lastReadAt: text("last_read_at"), archived: integer("archived").notNull().default(0),
}, (t) => [uniqueIndex("conversation_member_unique").on(t.conversationId, t.employeeId), index("conversations_by_member").on(t.employeeId)]);
export const messages = pgTable("messages", {
  id: key(), conversationId: text("conversation_id").notNull().references(() => conversations.id),
  senderId: text("sender_id").notNull().references(() => employees.id), body: text("body").notNull(),
  replyTo: text("reply_to"), editedAt: text("edited_at"), deletedAt: text("deleted_at"), pinned: integer("pinned").notNull().default(0), createdAt: stamp(),
}, (t) => [index("messages_by_conversation_time").on(t.conversationId, t.createdAt)]);
export const reactions = pgTable("message_reactions", {
  id: key(), messageId: text("message_id").notNull().references(() => messages.id),
  employeeId: text("employee_id").notNull().references(() => employees.id), emoji: text("emoji").notNull(),
}, (t) => [uniqueIndex("reaction_unique").on(t.messageId, t.employeeId, t.emoji)]);

export const meetings = pgTable("meetings", {
  id: key(), orgId: text("org_id").notNull().references(() => organizations.id),
  organizerId: text("organizer_id").notNull().references(() => employees.id),
  title: text("title").notNull(), startsAt: text("starts_at").notNull(), endsAt: text("ends_at").notNull(),
  providerRoom: text("provider_room"), createdAt: stamp(),
});
export const meetingMembers = pgTable("meeting_members", {
  id: key(), meetingId: text("meeting_id").notNull().references(() => meetings.id),
  employeeId: text("employee_id").notNull().references(() => employees.id),
}, (t) => [uniqueIndex("meeting_member_unique").on(t.meetingId, t.employeeId)]);

export const documents = pgTable("documents", {
  id: key(), orgId: text("org_id").notNull().references(() => organizations.id),
  ownerId: text("owner_id").notNull().references(() => employees.id), name: text("name").notNull(), mime: text("mime").notNull(),
  bytes: integer("bytes").notNull(), storageKey: text("storage_key").notNull().unique(), revokedAt: text("revoked_at"), createdAt: stamp(),
});
export const documentGrants = pgTable("document_grants", {
  id: key(), documentId: text("document_id").notNull().references(() => documents.id), employeeId: text("employee_id").notNull().references(() => employees.id),
  allowDownload: integer("allow_download").notNull().default(0), createdAt: stamp(),
}, (t) => [uniqueIndex("document_grant_unique").on(t.documentId, t.employeeId)]);

export const compensation = pgTable("compensation", {
  id: key(), employeeId: text("employee_id").notNull().references(() => employees.id),
  kind: text("kind").notNull(), amountCents: integer("amount_cents").notNull(), currency: text("currency").notNull(),
  effectiveOn: text("effective_on").notNull(), createdBy: text("created_by").notNull(), createdAt: stamp(),
}, (t) => [uniqueIndex("compensation_employee_date").on(t.employeeId, t.effectiveOn)]);
export const payroll = pgTable("payroll", {
  id: key(), orgId: text("org_id").notNull().references(() => organizations.id), employeeId: text("employee_id").notNull().references(() => employees.id),
  startsOn: text("starts_on").notNull(), endsOn: text("ends_on").notNull(), currency: text("currency").notNull(),
  payableSeconds: integer("payable_seconds").notNull(), grossCents: integer("gross_cents").notNull(),
  status: text("status").notNull().default("Estimate"), calculation: text("calculation").notNull(),
  createdBy: text("created_by").notNull(), createdAt: stamp(),
});
export const holidays = pgTable("holidays", {
  id: key(), orgId: text("org_id").notNull().references(() => organizations.id),
  name: text("name").notNull(), onDate: text("on_date").notNull(), jurisdiction: text("jurisdiction").notNull(),
  type: text("type").notNull(), createdAt: stamp(),
});
export const notifications = pgTable("notifications", {
  id: key(), employeeId: text("employee_id").notNull().references(() => employees.id), title: text("title").notNull(),
  body: text("body").notNull(), href: text("href").notNull(), readAt: text("read_at"), createdAt: stamp(),
}, (t) => [index("notifications_employee_time").on(t.employeeId, t.createdAt)]);
export const integrationSettings = pgTable("integrations", {
  id: key(), configuration: text("configuration").notNull(), enabled: integer("enabled").notNull().default(0), updatedAt: stamp("updated_at"),
});

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
export const fileObjects = pgTable("file_objects", {
  id: key(), content: bytea("content").notNull(),
});
export const credentials = pgTable("credentials", {
  employeeId: text("employee_id").primaryKey().references(() => employees.id),
  passwordHash: text("password_hash").notNull(), updatedAt: stamp("updated_at"),
});
export const invitations = pgTable("invitations", {
  id: key(), employeeId: text("employee_id").notNull().references(() => employees.id),
  codeHash: text("code_hash").notNull().unique(), expiresAt: text("expires_at").notNull(), consumedAt: text("consumed_at"),
});
