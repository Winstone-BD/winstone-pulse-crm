import { describe, expect, it } from "vitest";
import { canSaveReport, isTypingTarget, matchCallShortcut, pickNextEligible } from "@/lib/call-shortcuts";

const btn = { tagName: "BUTTON" } as unknown as EventTarget;
const base = { key: "", code: "", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, repeat: false, isComposing: false, target: btn };

describe("call shortcuts", () => {
  it("maps Ctrl/Cmd+Enter to save and Alt+Shift+N to next", () => {
    expect(matchCallShortcut({ ...base, key: "Enter", ctrlKey: true })).toBe("save");
    expect(matchCallShortcut({ ...base, key: "Enter", metaKey: true })).toBe("save");
    expect(matchCallShortcut({ ...base, key: "˜", code: "KeyN", altKey: true, shiftKey: true })).toBe("next");
  });
  it("ignores plain Enter, AltGr combos and browser-reserved Alt+Arrow", () => {
    expect(matchCallShortcut({ ...base, key: "Enter" })).toBeNull();
    expect(matchCallShortcut({ ...base, code: "KeyN", altKey: true, shiftKey: true, ctrlKey: true })).toBeNull();
    expect(matchCallShortcut({ ...base, key: "ArrowRight", altKey: true })).toBeNull();
  });
  it("suppresses while typing, composing (IME) or on key repeat", () => {
    for (const t of [{ tagName: "TEXTAREA" }, { tagName: "INPUT", type: "text" }, { tagName: "DIV", isContentEditable: true }]) {
      expect(matchCallShortcut({ ...base, key: "Enter", ctrlKey: true, target: t as unknown as EventTarget })).toBeNull();
    }
    expect(isTypingTarget({ tagName: "INPUT", type: "checkbox" } as unknown as EventTarget)).toBe(false);
    expect(matchCallShortcut({ ...base, key: "Enter", ctrlKey: true, isComposing: true })).toBeNull();
    expect(matchCallShortcut({ ...base, key: "Enter", ctrlKey: true, keyCode: 229 })).toBeNull();
    expect(matchCallShortcut({ ...base, key: "Enter", ctrlKey: true, repeat: true })).toBeNull();
  });
  it("save only when the report is open, complete and not already sending", () => {
    expect(canSaveReport({ open: true, missing: null, pending: false })).toBe(true);
    expect(canSaveReport({ open: true, missing: "ফলাফল", pending: false })).toBe(false);
    expect(canSaveReport({ open: true, missing: null, pending: true })).toBe(false); // duplicate submit
    expect(canSaveReport({ open: false, missing: null, pending: false })).toBe(false);
  });
  it("next lead skips current, done, closed and completed leads", () => {
    const rows = [
      { id: "a" }, { id: "b", status: "closed" }, { id: "c", work_state: "completed" }, { id: "d" }, { id: "e" },
    ];
    expect(pickNextEligible(rows, ["d"], "a")?.id).toBe("e");
    expect(pickNextEligible(rows, ["a", "d", "e"])).toBeNull();
  });
});

import { createSaveLatch } from "@/lib/call-shortcuts";

describe("save latch (shortcut submit flow)", () => {
  const ok = { open: true, missing: null, pending: false };
  it("runs once and ignores duplicate presses until settled", () => {
    const latch = createSaveLatch();
    let calls = 0;
    expect(latch.try(ok, () => calls++)).toBe("ran");
    expect(latch.try(ok, () => calls++)).toBe("busy");
    expect(calls).toBe(1);
    latch.release();
    expect(latch.try(ok, () => calls++)).toBe("ran");
  });
  it("never submits an incomplete report", () => {
    const latch = createSaveLatch();
    let calls = 0;
    expect(latch.try({ ...ok, missing: "Outcome" }, () => calls++)).toBe("blocked");
    expect(calls).toBe(0);
    expect(latch.busy).toBe(false);
  });
  it("after a failed save the latch releases and no advance happens", async () => {
    const latch = createSaveLatch();
    const advanced: string[] = [];
    const submit = () => Promise.reject(new Error("server refused"));
    latch.try(ok, () => {
      submit()
        .then(() => advanced.push("next")) // advance only on success (mirrors onSuccess)
        .catch(() => undefined)
        .finally(() => latch.release());
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(advanced).toEqual([]);
    expect(latch.busy).toBe(false);
  });
  it("after a successful save it advances exactly once", async () => {
    const latch = createSaveLatch();
    const advanced: string[] = [];
    latch.try(ok, () => {
      Promise.resolve().then(() => advanced.push("next")).finally(() => latch.release());
    });
    latch.try(ok, () => advanced.push("dup"));
    await new Promise((r) => setTimeout(r, 0));
    expect(advanced).toEqual(["next"]);
  });
});
