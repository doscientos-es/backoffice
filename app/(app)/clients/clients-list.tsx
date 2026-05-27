"use client";

import { ListPage, type ListPageProps } from "@/components/layout/list-page";
import { useState } from "react";
import { ClientQuickView, type QuickClient } from "./client-quick-view";

export function ClientsList(props: ListPageProps) {
  const [selectedClient, setSelectedClient] = useState<QuickClient | null>(null);

  return (
    <>
      <ListPage {...props} onRowClick={(row) => setSelectedClient(row.data as QuickClient)} />
      <ClientQuickView client={selectedClient} onClose={() => setSelectedClient(null)} />
    </>
  );
}
