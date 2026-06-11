"use server";

import { defineAction } from "@/lib/actions/define-action";
import { AddWorkLogInput, DeleteWorkLogInput } from "@/lib/schemas/work-log";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Records a manual hours entry for the current user on a project. The
 * `member_id` is taken from the authenticated context, never from input,
 * so a member can only log time under their own name.
 */
export const addWorkLog = defineAction({
  name: "work_logs.add",
  schema: AddWorkLogInput,
  roles: ["owner", "admin", "member"],
  revalidate: (_payload, input) => [`/projects/${input.project_id}`],
  handler: async (input, { user }) => {
    const supabase = await createServerClient();
    const { error } = await supabase.from("work_logs").insert({
      project_id: input.project_id,
      member_id: user.id,
      work_date: input.work_date,
      hours: input.hours,
      note: input.note?.trim() || null,
    });

    if (error) throw new Error(error.message);
  },
});

/**
 * Soft-deletes a work-log entry by stamping `deleted_at`. The select RLS
 * policy and the project query both filter on `deleted_at is null`, so the
 * row disappears after revalidation.
 */
export const deleteWorkLog = defineAction({
  name: "work_logs.delete",
  schema: DeleteWorkLogInput,
  roles: ["owner", "admin", "member"],
  revalidate: (_payload, input) => [`/projects/${input.project_id}`],
  handler: async (input) => {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("work_logs")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", input.id);

    if (error) throw new Error(error.message);
  },
});
