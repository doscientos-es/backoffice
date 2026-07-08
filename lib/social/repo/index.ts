/**
 * Social Hub — repository barrel.
 *
 * Single entry point for all DB access (posts, insights, comments). Services and
 * server actions import from here so persistence details stay swappable behind
 * one module boundary.
 */
export * from "./posts";
export * from "./insights";
export * from "./comments";
