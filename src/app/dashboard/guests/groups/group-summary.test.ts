import { describe, it, expect } from "vitest";
import { summarizeGroup, type SummarizableGroup, type GroupMemberRef } from "./group-summary";

const member = (over: Partial<GroupMemberRef> = {}): GroupMemberRef => ({
  id: "m1",
  name: "Ana",
  phone: null,
  email: null,
  rsvpStatus: "INVITED",
  ...over,
});

const group = (over: Partial<SummarizableGroup> = {}): SummarizableGroup => ({
  contactPhone: null,
  contactEmail: null,
  guests: [],
  ...over,
});

describe("summarizeGroup", () => {
  it("counts confirmed, declined and pending members", () => {
    const s = summarizeGroup(
      group({
        guests: [
          member({ id: "1", rsvpStatus: "CONFIRMED" }),
          member({ id: "2", rsvpStatus: "DECLINED" }),
          member({ id: "3", rsvpStatus: "INVITED" }),
          member({ id: "4", rsvpStatus: "MAYBE" }),
        ],
      }),
    );
    expect(s.memberCount).toBe(4);
    expect(s.confirmed).toBe(1);
    expect(s.declined).toBe(1);
    expect(s.pending).toBe(2);
  });

  it("uses the group's own contact when present (no fallback)", () => {
    const s = summarizeGroup(
      group({ contactPhone: "11999990000", guests: [member({ phone: "11888880000" })] }),
    );
    expect(s.effectivePhone).toBe("+5511999990000");
    expect(s.willReceive).toBe(true);
    expect(s.usesFallback).toBe(false);
    expect(s.fallbackName).toBeNull();
  });

  it("falls back to the first member with a valid phone", () => {
    const s = summarizeGroup(
      group({
        guests: [
          member({ id: "1", name: "Ana", phone: "abc" }),
          member({ id: "2", name: "Beto", phone: "11999990000" }),
        ],
      }),
    );
    expect(s.effectivePhone).toBe("+5511999990000");
    expect(s.usesFallback).toBe(true);
    expect(s.fallbackName).toBe("Beto");
    expect(s.willReceive).toBe(true);
  });

  it("falls back to a member's email when there is no phone anywhere", () => {
    const s = summarizeGroup(
      group({ guests: [member({ name: "Ana", email: "ana@example.com" })] }),
    );
    expect(s.effectivePhone).toBeNull();
    expect(s.effectiveEmail).toBe("ana@example.com");
    expect(s.usesFallback).toBe(true);
    expect(s.fallbackName).toBe("Ana");
  });

  it("flags groups that nobody can receive", () => {
    const s = summarizeGroup(group({ guests: [member({ phone: "123", email: null })] }));
    expect(s.willReceive).toBe(false);
    expect(s.effectivePhone).toBeNull();
    expect(s.effectiveEmail).toBeNull();
    expect(s.usesFallback).toBe(false);
  });

  it("treats an empty group as unreachable", () => {
    const s = summarizeGroup(group({}));
    expect(s.memberCount).toBe(0);
    expect(s.willReceive).toBe(false);
  });
});
