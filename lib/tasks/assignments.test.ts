import { describe, expect, it } from "vitest";
import { mergeTaskMemberIds } from "./assignments";

describe("mergeTaskMemberIds", () => {
  it("keeps the legacy primary assignee when no relation rows exist", () => {
    expect(mergeTaskMemberIds("primary", [])).toEqual(["primary"]);
  });

  it("merges collaborators without duplicating the primary assignee", () => {
    expect(mergeTaskMemberIds("primary", ["primary", "gerard", null, undefined])).toEqual([
      "primary",
      "gerard",
    ]);
  });
});
