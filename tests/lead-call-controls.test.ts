import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/crm/WebCallButton", () => ({
  WebCallButton: (props: { leadId: string; phone: string; label: string; className: string; ariaLabel: string }) =>
    React.createElement("button", { "data-action": "existing-call", "data-lead": props.leadId, "data-phone": props.phone, className: props.className, "aria-label": props.ariaLabel }, props.label),
}));
vi.mock("@/components/crm/CallbackLogButton", () => ({
  CallbackLogButton: (props: { leadId: string; ariaLabel: string }) => React.createElement("button", { "data-action": "existing-callback", "data-lead": props.leadId, "aria-label": props.ariaLabel }),
}));
vi.mock("@/components/crm/WhatsAppAction", () => ({
  WhatsAppAction: (props: { leadId: string; phone: string; ariaLabel: string }) => React.createElement("button", { "data-action": "existing-whatsapp", "data-lead": props.leadId, "data-phone": props.phone, "aria-label": props.ariaLabel }),
}));
import { LeadCallControls } from "@/components/crm/desk/LeadCallControls";

describe("phone-style lead controls", () => {
  const html = () => renderToStaticMarkup(React.createElement(LeadCallControls, { leadId: "unit-only", name: "Test customer", phone: "unit-phone", onDetails: () => {} }));
  it("delegates to the existing call, WhatsApp and callback paths", () => {
    const output = html();
    for (const action of ["existing-call", "existing-whatsapp", "existing-callback"]) {
      expect(output).toContain(`data-action="${action}"`);
    }
    expect(output.match(/data-lead="unit-only"/g)).toHaveLength(3);
    expect(output.match(/data-phone="unit-phone"/g)).toHaveLength(2);
  });
  it("renders four named controls with a large call target and no invented call state", () => {
    const output = html();
    expect(output.match(/aria-label=/g)).toHaveLength(4);
    expect(output).toContain("h-14 w-full rounded-full");
    expect(output).toContain("Your SIM"); // English is the default language
    expect(output).not.toContain("Connected");
    expect(output).not.toContain("tel:");
  });
});