import { fireEvent, render, screen } from "@testing-library/react";
import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/input", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));
vi.mock("@/components/ui/select", () => ({
  Select: (props: SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} />,
}));

import { InvoiceItemsSummary } from "./invoice-items-summary";
import { LineItemsTable } from "./line-items-table";

const item = {
  id: "line-1",
  description: "Servicio de consultoría",
  quantity: 2,
  unit_price: 100,
  vat_rate: 21,
  subtotal: 200,
  billing_cycle: "none" as const,
};

describe("invoice line item UI", () => {
  it("duplicates an editable concept while preserving its values", () => {
    const onChange = vi.fn();
    render(<LineItemsTable items={[item]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Duplicar línea 1" }));

    expect(onChange).toHaveBeenCalledOnce();
    const nextItems = onChange.mock.calls[0][0];
    expect(nextItems).toHaveLength(2);
    expect(nextItems[1]).toMatchObject({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      vat_rate: item.vat_rate,
    });
    expect(nextItems[1].id).not.toBe(item.id);
  });

  it("renders desktop columns, mobile concepts and the fiscal summary", () => {
    render(
      <InvoiceItemsSummary
        items={[item]}
        subtotal={200}
        total={242}
        vatBreakdown={[{ rate: 21, base: 200, tax: 42 }]}
      />,
    );

    expect(screen.getByRole("table")).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "Precio unitario" })).toBeDefined();
    expect(screen.getAllByText(item.description)).toHaveLength(2);
    expect(screen.getByText("Base imponible")).toBeDefined();
    expect(screen.getByText("Total")).toBeDefined();
  });
});
