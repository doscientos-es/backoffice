import { toDatetimeLocalValue } from "@/lib/utils/date-time";

export function defaultMeetingStart(now: Date = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return toDatetimeLocalValue(date);
}

export function defaultMeetingEnd(now: Date = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  date.setHours(11, 0, 0, 0);
  return toDatetimeLocalValue(date);
}
