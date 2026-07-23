import type { ComposedPost } from "@/lib/social/core";
import { describe, expect, it, vi } from "vitest";
import { GoogleBusinessProfilePublisher } from "./google-business-publisher";

const request = vi.hoisted(() => vi.fn());

vi.mock("./client", () => ({
  googleBusinessAccountId: () => "account-1",
  googleBusinessLanguageCode: () => "es-ES",
  googleBusinessLocationId: () => "location-1",
  googleBusinessProfileConfigured: () => true,
  googleBusinessRequest: request,
}));

const textPost = (overrides: Partial<ComposedPost> = {}): ComposedPost => ({
  id: "post-1",
  caption: "Novedades de doscientos",
  mediaKind: "text",
  media: [],
  ...overrides,
});

describe("GoogleBusinessProfilePublisher", () => {
  it("supports text and image posts", () => {
    const publisher = new GoogleBusinessProfilePublisher();

    expect(publisher.supports(textPost())).toEqual({ ok: true });
    expect(
      publisher.supports(
        textPost({
          mediaKind: "photo",
          media: [
            {
              storagePath: "image.jpg",
              publicUrl: "https://cdn/image.jpg",
              type: "image",
              mime: "image/jpeg",
            },
          ],
        }),
      ),
    ).toEqual({ ok: true });
  });

  it("rejects videos and summaries longer than the Google limit", () => {
    const publisher = new GoogleBusinessProfilePublisher();

    expect(
      publisher.supports(
        textPost({
          mediaKind: "video",
          media: [
            {
              storagePath: "video.mp4",
              publicUrl: "https://cdn/video.mp4",
              type: "video",
              mime: "video/mp4",
            },
          ],
        }),
      ),
    ).toMatchObject({ ok: false });
    expect(publisher.supports(textPost({ caption: "x".repeat(1_501) }))).toMatchObject({
      ok: false,
    });
  });

  it("publishes a Local Post and returns Google's resource identity", async () => {
    request.mockResolvedValueOnce({
      name: "accounts/account-1/locations/location-1/localPosts/post-1",
      searchUrl: "https://www.google.com/search?q=doscientos",
    });
    const publisher = new GoogleBusinessProfilePublisher();

    await expect(publisher.publish(textPost())).resolves.toEqual({
      remoteId: "accounts/account-1/locations/location-1/localPosts/post-1",
      remoteUrl: "https://www.google.com/search?q=doscientos",
    });
    expect(request).toHaveBeenCalledWith(
      "accounts/account-1/locations/location-1/localPosts",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
