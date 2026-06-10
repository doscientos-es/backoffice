import {
  createEmptyKeyPoint,
  parseKeyPoints,
  serializeKeyPoints,
  toEditableKeyPoints,
} from "@/lib/proposals/key-points";
import { describe, expect, it } from "vitest";

describe("parseKeyPoints", () => {
  it("returns [] for non-array input", () => {
    expect(parseKeyPoints(null)).toEqual([]);
    expect(parseKeyPoints(undefined)).toEqual([]);
    expect(parseKeyPoints("nope")).toEqual([]);
    expect(parseKeyPoints({})).toEqual([]);
  });

  it("normalises entries and trims the title", () => {
    expect(parseKeyPoints([{ id: "x", title: "  Hello  ", description: "World" }])).toEqual([
      { id: "x", title: "Hello", description: "World" },
    ]);
  });

  it("drops entries without a usable title", () => {
    const out = parseKeyPoints([
      { title: "" },
      { title: "   " },
      { description: "orphan" },
      { title: "keep" },
    ]);
    expect(out).toEqual([{ id: "kp-3", title: "keep", description: null }]);
  });

  it("synthesises an id from the index when missing or blank", () => {
    const out = parseKeyPoints([{ title: "a" }, { id: "", title: "b" }]);
    expect(out.map((k) => k.id)).toEqual(["kp-0", "kp-1"]);
  });

  it("nulls out blank/whitespace descriptions", () => {
    const out = parseKeyPoints([{ title: "t", description: "   " }]);
    expect(out[0]?.description).toBeNull();
  });

  it("skips non-object array members (index is over the filtered array)", () => {
    const out = parseKeyPoints([42, "str", null, { title: "ok" }]);
    expect(out).toEqual([{ id: "kp-0", title: "ok", description: null }]);
  });
});

describe("toEditableKeyPoints", () => {
  it("hydrates null descriptions into empty strings", () => {
    expect(
      toEditableKeyPoints([
        { id: "1", title: "a", description: null },
        { id: "2", title: "b", description: "d" },
      ]),
    ).toEqual([
      { id: "1", title: "a", description: "" },
      { id: "2", title: "b", description: "d" },
    ]);
  });
});

describe("serializeKeyPoints", () => {
  it("returns null for an empty list", () => {
    expect(serializeKeyPoints([])).toBeNull();
  });

  it("returns null when every entry is blank", () => {
    expect(
      serializeKeyPoints([
        { id: "1", title: "   ", description: "x" },
        { id: "2", title: "", description: "" },
      ]),
    ).toBeNull();
  });

  it("trims, drops blank titles and collapses empty descriptions to null", () => {
    expect(
      serializeKeyPoints([
        { id: "1", title: "  Keep  ", description: "  desc  " },
        { id: "2", title: "", description: "skip" },
        { id: "3", title: "NoDesc", description: "   " },
      ]),
    ).toEqual([
      { id: "1", title: "Keep", description: "desc" },
      { id: "3", title: "NoDesc", description: null },
    ]);
  });

  it("round-trips through parse → toEditable → serialize", () => {
    const stored = parseKeyPoints([
      { id: "a", title: "Problema", description: "Detalle" },
      { id: "b", title: "Solución", description: null },
    ]);
    const editable = toEditableKeyPoints(stored);
    expect(serializeKeyPoints(editable)).toEqual(stored);
  });
});

describe("createEmptyKeyPoint", () => {
  it("creates a blank point with a non-empty unique id", () => {
    const a = createEmptyKeyPoint();
    const b = createEmptyKeyPoint();
    expect(a.title).toBe("");
    expect(a.description).toBe("");
    expect(a.id.length).toBeGreaterThan(0);
    expect(a.id).not.toBe(b.id);
  });
});
