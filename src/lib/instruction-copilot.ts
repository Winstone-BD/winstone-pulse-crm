export type InstructionDraft =
  | { kind: "assignment"; employeeId: string | null; count: number | null }
  | { kind: "workspace"; section: "health" | "access" | "calls" | "billing" }
  | { kind: "build"; command: string };

/** Drafting only: no AI requests, permissions or writes. */
export function draftInstruction(input: string): InstructionDraft {
  const normalized = input.replace(/[০-৯]/g, digit => String("০১২৩৪৫৬৭৮৯".indexOf(digit))).trim();
  if (/\b(?:assign|send|distribute)\b|বণ্টন|অ্যাসাইন|লিড.*(?:দিন|দাও|পাঠা)/i.test(normalized)) {
    const employeeId = normalized.match(/\bWIN\d+\b/i)?.[0]?.toUpperCase() ?? null;
    const numbers = normalized.replace(/\bWIN\d+\b/gi, "").match(/\d+(?:\.\d+)?/g) ?? [];
    const count = numbers.length === 1 ? Number(numbers[0]) : null;
    return { kind: "assignment", employeeId, count: count !== null && Number.isInteger(count) && count > 0 && count <= 500 ? count : null };
  }
  if (/health|হেলথ|স্বাস্থ্য/i.test(normalized)) return { kind: "workspace", section: "health" };
  if (/account|অ্যাকাউন্ট/i.test(normalized)) return { kind: "workspace", section: "access" };
  if (/recording|রেকর্ডিং/i.test(normalized)) return { kind: "workspace", section: "calls" };
  if (/billing|বিল/i.test(normalized)) return { kind: "workspace", section: "billing" };
  return { kind: "build", command: `Winstone Pulse CRM change request:\n${input.trim()}\n\nPreserve existing permissions, PIN boundaries and all customer data. Propose the smallest focused change, require confirmation for operational actions, and verify the affected workflow. Do not expose secrets, invent facts, or publish without explicit approval.` };
}