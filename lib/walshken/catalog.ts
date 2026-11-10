import codes from "../country-codes.json";

const names = new Intl.DisplayNames(["en"], { type: "region" });
export const countries = codes.map(([code, alpha3]) => ({
  code,
  alpha3,
  name: names.of(code) ?? code,
})).sort((a, b) => a.name.localeCompare(b.name));

export const countryName = (code: string) => countries.find((c) => c.code === code)?.name ?? code;

export function searchCountries(input: string) {
  const q = input.trim().toLowerCase();
  return q ? countries.filter((country) =>
    country.code.toLowerCase() === q || country.alpha3.toLowerCase().startsWith(q) ||
    country.name.toLowerCase().includes(q),
  ).sort((a,b)=>Number(b.name.toLowerCase().startsWith(q))-Number(a.name.toLowerCase().startsWith(q))) : countries;
}

export const divisions = [
  { id: "technology", name: "IT & Technology", description: "Digital systems, technical support and technology services for growing organizations.", icon: "technology" },
  { id: "accounting", name: "Accounting", description: "Bookkeeping, financial reporting and practical support for day-to-day business finances.", icon: "accounting" },
  { id: "travel", name: "Tours & Travel", description: "Trip planning and travel support for personal and business journeys.", icon: "travel" },
  { id: "immigration", name: "Immigration", description: "Explore immigration service options and connect with the appropriate team.", icon: "immigration" },
  { id: "education", name: "Education", description: "Guidance for exploring study options, educational pathways and next steps.", icon: "education" },
  { id: "taxation", name: "Taxation", description: "Tax preparation and related support for individuals and businesses.", icon: "taxation" },
  { id: "paralegal", name: "Paralegal Services", description: "Find paralegal support according to the services available in your jurisdiction.", icon: "paralegal" },
] as const;

export const homepage = {
  title: "Find the right professional support, wherever you are.",
  description: "Explore services for your business and personal plans. Choose what you need, check availability in your country, and get in touch with the right team.",
  about: "Walshken brings specialist divisions together so people and businesses can find professional support in one place. Services and contact options are published by country as they become available.",
};

export const roles = ["super_admin", "admin", "hr", "manager", "employee", "guest"] as const;
export type Role = typeof roles[number];

export const roleNames: Record<Role, string> = {
  super_admin: "Super Admin", admin: "Admin", hr: "HR / Payroll",
  manager: "Coordinator / Manager", employee: "Employee", guest: "External Client / Guest",
};

export const taskStatuses = ["Not Started", "In Progress", "Waiting for Review", "On Hold", "Completed", "Cancelled"] as const;

export const providers = [
  { id: "daily", name: "Daily", category: "Video & audio", description: "Private meeting rooms and browser calling.", fields: [["domain", "Daily subdomain"], ["apiKey", "API key"]] },
  { id: "twilio", name: "Twilio", category: "SMS", description: "SMS alerts for workflows that are enabled later.", fields: [["accountSid", "Account SID"], ["authToken", "Auth token"], ["from", "Sender number"]] },
  { id: "resend", name: "Resend", category: "Email", description: "Transactional email and staff notifications.", fields: [["apiKey", "API key"], ["from", "Verified sender address"]] },
  { id: "payroll", name: "Payroll provider", category: "Payroll", description: "Configuration for a validated payroll provider.", fields: [["account", "Provider account or reference"], ["apiKey", "API key"]] },
] as const;

export const staffNav = [
  { title: "Workspace", items: [["dashboard", "Overview", "layout"], ["messages", "Messages", "message"], ["calls", "Calls & meetings", "video"], ["tasks", "My tasks", "check"], ["projects", "Projects", "project"], ["calendar", "Calendar", "calendar"]] },
  { title: "People & time", items: [["attendance", "Attendance", "clock"], ["shifts", "Shifts", "shift"], ["timesheets", "Timesheets", "list"], ["salary", "Salary & payslips", "wallet"], ["leave", "Leave requests", "leave"], ["documents", "Documents", "file"], ["directory", "Team directory", "users"], ["notifications", "Notifications", "bell"], ["profile", "My profile", "user"]] },
] as const;

export const adminNav = [
  ["employees", "Employees", "users"], ["departments", "Organization", "building"], ["roles", "Roles & permissions", "shield"],
  ["scheduling", "Shift scheduling", "shift"], ["approvals", "Timesheet approvals", "list"], ["payroll", "Payroll management", "wallet"],
  ["holidays", "Holiday settings", "calendar"], ["reports", "Reports", "chart"], ["document-security", "Document security", "lock"],
  ["audit", "Activity & audit", "history"], ["website", "Website services", "globe"], ["countries", "Country availability", "pin"], ["integrations", "Integrations", "plug"],
] as const;
