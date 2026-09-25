import type { Timestamp } from "firebase/firestore";

export type PaymentStatus = "pending" | "partial" | "paid" | "credit" | "clear";
export type ExpenseType = "one-time" | "monthly" | "recurring";
export type ActivityAction =
  | "expense.created" | "expense.updated" | "expense.deleted"
  | "payment.recorded" | "resident.created" | "resident.updated"
  | "resident.deleted" | "flat.created" | "flat.updated"
  | "category.created" | "category.updated" | "category.deleted"
  | "recurring.created" | "recurring.updated" | "recurring.deleted"
  | "monthly.generated" | "backup.restored";

export interface Resident {
  id: string;
  name: string;
  flatId: string;
  phone?: string;
  shares: number;
  active: boolean;
  notes?: string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface Flat {
  id: string;
  number: string;
  label?: string;
  active: boolean;
  createdAt?: Timestamp | string;
}

export interface Category {
  id: string;
  name: string;
  color?: string;
  active: boolean;
}

export interface Expense {
  id: string;
  title: string;
  description?: string;
  categoryId: string;
  amountCents: number;
  payerId: string;
  date: string;
  dueDate?: string;
  type: ExpenseType;
  recurringId?: string;
  splitMode: "shares" | "equal" | "custom";
  split?: Record<string, number>;
  receiptUrl?: string;
  receiptName?: string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface Payment {
  id: string;
  residentId: string;
  amountCents: number;
  date: string;
  note?: string;
  expenseId?: string;
  createdAt?: Timestamp | string;
}

export interface RecurringExpense {
  id: string;
  title: string;
  amountCents: number;
  categoryId: string;
  payerId: string;
  dayOfMonth: number;
  active: boolean;
  splitMode: "shares" | "equal" | "custom";
  split?: Record<string, number>;
  startMonth: string;
  lastGeneratedMonth?: string;
  createdAt?: Timestamp | string;
}

export interface ActivityLog {
  id: string;
  action: ActivityAction;
  actorEmail: string;
  recordId?: string;
  recordLabel?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Timestamp | string;
}

export interface AppSettings {
  currency: "INR";
  propertyName: string;
  monthStartDay: number;
  updatedAt?: Timestamp | string;
}

export interface AppData {
  residents: Resident[];
  flats: Flat[];
  categories: Category[];
  expenses: Expense[];
  payments: Payment[];
  recurringExpenses: RecurringExpense[];
  activityLogs: ActivityLog[];
  settings: AppSettings;
}