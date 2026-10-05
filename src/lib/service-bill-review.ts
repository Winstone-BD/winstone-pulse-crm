import { MAINTENANCE_FEE_USD } from "@/lib/maintenance-rules";

export const SERVICE_BILL_NAME = "Winstone CRM IT Service & Maintenance";
export const SERVICE_BILL_ISSUER = "Winstone IT Team";
export const SERVICE_BILL_STATUS = "Pending Review";

export type ServiceBillReviewStatus = "pending_review" | "in_review";

export type ServiceBillPayload = {
  bill_id: string;
  service_name: string;
  amount: number;
  currency: "USD";
  status: "Pending Review";
  issuer: string;
  recipient: string;
  created_at: string;
  due_at: string;
  review_status: ServiceBillReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

export type ServiceBillRow = {
  id: string;
  created_at: string;
  due_date: string;
  review_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

export function serviceBillPayload(row: ServiceBillRow, recipient: string): ServiceBillPayload {
  return {
    bill_id: row.id,
    service_name: SERVICE_BILL_NAME,
    amount: MAINTENANCE_FEE_USD,
    currency: "USD",
    status: SERVICE_BILL_STATUS,
    issuer: SERVICE_BILL_ISSUER,
    recipient,
    created_at: row.created_at,
    due_at: row.due_date,
    review_status: row.review_status === "in_review" ? "in_review" : "pending_review",
    reviewed_by: row.reviewed_by,
    reviewed_at: row.reviewed_at,
  };
}

export const HOSTINGER_REVIEW_SECRET_NAMES = [
  "NOTIFY_EMAIL_ENDPOINT",
  "NOTIFY_EMAIL_API_KEY",
  "HOSTINGER_SENDER_EMAIL",
  "SERVICE_BILL_APPROVER_EMAIL",
] as const;

export function missingServiceBillEmailSecrets(env: Record<string, string | undefined>): string[] {
  return HOSTINGER_REVIEW_SECRET_NAMES.filter((name) => !env[name]?.trim());
}
