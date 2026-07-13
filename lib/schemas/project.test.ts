import {
  GithubSyncMode,
  ProjectInput,
  ProjectStatus,
  UpdateProjectInput,
} from "@/lib/schemas/project";
import { describe, expect, it } from "vitest";

const uuid = "11111111-1111-1111-1111-111111111111";

const base = { client_id: uuid, name: "Web corporativa" };

describe("project enums", () => {
  it("validate status and sync mode", () => {
    expect(ProjectStatus.safeParse("active").success).toBe(true);
    expect(GithubSyncMode.safeParse("bidirectional").success).toBe(true);
    expect(ProjectStatus.safeParse("nope").success).toBe(false);
  });
});

describe("ProjectInput github refinement", () => {
  it("applies defaults when sync is disabled", () => {
    const out = ProjectInput.parse(base);
    expect(out.status).toBe("planning");
    expect(out.github_sync_mode).toBe("none");
    expect(out.github_auto_sync).toBe(true);
  });
  it("requires a repo url when sync is enabled", () => {
    expect(ProjectInput.safeParse({ ...base, github_sync_mode: "one_way" }).success).toBe(false);
  });
  it("rejects a malformed repo url", () => {
    expect(
      ProjectInput.safeParse({
        ...base,
        github_sync_mode: "one_way",
        github_repo: "https://example.com/x",
      }).success,
    ).toBe(false);
  });
  it("accepts a valid repo url for one-way sync", () => {
    expect(
      ProjectInput.safeParse({
        ...base,
        github_sync_mode: "one_way",
        github_repo: "https://github.com/owner/repo",
      }).success,
    ).toBe(true);
  });
  it("requires an installation id for bidirectional sync", () => {
    const repo = "https://github.com/owner/repo";
    expect(
      ProjectInput.safeParse({ ...base, github_sync_mode: "bidirectional", github_repo: repo })
        .success,
    ).toBe(false);
    expect(
      ProjectInput.safeParse({
        ...base,
        github_sync_mode: "bidirectional",
        github_repo: repo,
        github_installation_id: "123",
      }).success,
    ).toBe(true);
  });
});

describe("UpdateProjectInput", () => {
  it("requires a valid id", () => {
    expect(UpdateProjectInput.safeParse(base).success).toBe(false);
    expect(UpdateProjectInput.safeParse({ ...base, id: uuid }).success).toBe(true);
  });
});
