"use server";

import { defineAction } from "@/lib/actions/define-action";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const subscriptionSchema = z.object({
  client_id: z.string().uuid("Cliente requerido"),
  project_id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().min(1, "Nombre requerido").max(200),
  description: z.string().max(1000).optional(),
  status: z.enum(["active", "paused", "cancelled"]).default("active"),
  billing_cycle: z.enum(["monthly", "quarterly", "yearly"]).default("monthly"),
  amount: z.coerce.number().min(0, "Importe requerido"),
  vat_rate: z.coerce.number().min(0).max(100).default(21),
  start_date: z.string().date(),
  next_invoice_date: z.string().date(),
  end_date: z.string().date().optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
});

export const createSubscription = defineAction({
  name: "subscriptions.create",
  schema: subscriptionSchema,
  roles: ["owner", "admin", "member"],
  revalidate: ["/subscriptions"],
  async handler(input) {
    const supabase = await createServerClient();
    const { error } = await supabase.from("subscriptions").insert({
      ...input,
      project_id: input.project_id || null,
      end_date: input.end_date || null,
    });
    if (error) throw new Error(error.message);
  },
});

export const updateSubscription = defineAction({
  name: "subscriptions.update",
  schema: subscriptionSchema.extend({ id: z.string().uuid() }),
  roles: ["owner", "admin", "member"],
  revalidate: (_, input) => ["/subscriptions", `/subscriptions/${input.id}`],
  async handler(input) {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("subscriptions")
      .update({
        ...input,
        project_id: input.project_id || null,
        end_date: input.end_date || null,
      })
      .eq("id", input.id);
    if (error) throw new Error(error.message);
  },
});

export const deleteSubscription = defineAction({
  name: "subscriptions.delete",
  schema: z.object({ id: z.string().uuid() }),
  roles: ["owner", "admin"],
  revalidate: ["/subscriptions"],
  async handler({ id }) {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("subscriptions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
  },
});

export const restoreSubscription = defineAction({
  name: "subscriptions.restore",
  schema: z.object({ id: z.string().uuid() }),
  roles: ["owner", "admin"],
  revalidate: ["/subscriptions"],
  async handler({ id }) {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("subscriptions")
      .update({ deleted_at: null })
      .eq("id", id);
    if (error) throw new Error(error.message);
  },
});
