"use client";

import { ListPage, type ListPageProps } from "@/components/layout/list-page";
import { useOptimisticRemoval } from "@/lib/hooks/use-optimistic-removal";
import { useState } from "react";
import { deleteClient } from "./actions";
import { ClientQuickView, type QuickClient } from "./client-quick-view";

export function ClientsList({ canEdit = false, ...props }: ListPageProps & { canEdit?: boolean }) {
  const [selectedClient, setSelectedClient] = useState<QuickClient | null>(null);
  const { items: rows, remove } = useOptimisticRemoval(props.rows);

  const handleDelete = (id: string) => {
    setSelectedClient(null);
    remove(id, () => deleteClient({ id }), { errorMessage: "No se pudo eliminar el cliente" });
  };

  return (
    <>
      <ListPage
        {...props}
        rows={rows}
        onRowClick={(row) => setSelectedClient(row.data as QuickClient)}
      />
      <ClientQuickView
        client={selectedClient}
        canEdit={canEdit}
        onDeleteAction={handleDelete}
        onCloseAction={() => setSelectedClient(null)}
      />
    </>
  );
}
