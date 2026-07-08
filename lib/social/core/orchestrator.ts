/**
 * Social Hub — fan-out orchestrator.
 *
 * Pure coordination logic (no I/O of its own): takes a composed post, the set
 * of target platforms and a registry, then publishes to each INDEPENDENTLY.
 * One platform failing never aborts the others — every target gets its own
 * try/catch and the aggregate status reflects the mix.
 */
import { toErrorMessage } from "./errors";
import type { PublisherRegistry } from "./registry";
import type { ComposedPost, FanOutResult, PostStatus, SocialPlatform, TargetResult } from "./types";

/** Derive the post-level status from its per-target results. */
export function computeAggregateStatus(targets: TargetResult[]): PostStatus {
  if (targets.length === 0) return "failed";
  const ok = targets.filter((t) => t.ok).length;
  if (ok === 0) return "failed";
  if (ok === targets.length) return "published";
  return "partially_failed";
}

/**
 * Publish `post` to `platforms`, resolving each Publisher from `registry`.
 * Targets run concurrently; each result is isolated. Missing/misconfigured
 * adapters or capability rejections surface as a failed target, not a throw.
 */
export async function fanOutPublish(
  post: ComposedPost,
  platforms: SocialPlatform[],
  registry: PublisherRegistry,
): Promise<FanOutResult> {
  const targets = await Promise.all(
    platforms.map((platform) => publishOne(post, platform, registry)),
  );
  return { status: computeAggregateStatus(targets), targets };
}

async function publishOne(
  post: ComposedPost,
  platform: SocialPlatform,
  registry: PublisherRegistry,
): Promise<TargetResult> {
  try {
    const publisher = registry.get(platform);

    const support = publisher.supports(post);
    if (!support.ok) {
      return { platform, ok: false, error: support.reason };
    }

    const outcome = await publisher.publish(post);
    return {
      platform,
      ok: true,
      remoteId: outcome.remoteId,
      remoteUrl: outcome.remoteUrl,
    };
  } catch (err) {
    return { platform, ok: false, error: toErrorMessage(err) };
  }
}
