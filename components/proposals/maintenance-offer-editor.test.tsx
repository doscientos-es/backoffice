import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MAINTENANCE_OFFER } from "@/lib/proposals/maintenance";
import { MaintenanceOfferEditor } from "./maintenance-offer-editor";

describe("MaintenanceOfferEditor", () => {
  it("shows and persists the exclusions textarea for each plan", () => {
    const onChange = vi.fn();
    render(
      <MaintenanceOfferEditor
        offer={DEFAULT_MAINTENANCE_OFFER}
        selectedPlanId={null}
        onChange={onChange}
        onSelectedPlanChange={vi.fn()}
        locked={false}
      />,
    );

    const exclusions = screen.getByLabelText("Exclusiones del plan Esencial");
    fireEvent.change(exclusions, {
      target: { value: "Cambios de contenido\nNuevas integraciones" },
    });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        plans: expect.arrayContaining([
          expect.objectContaining({
            id: "essential",
            exclusions: ["Cambios de contenido", "Nuevas integraciones"],
          }),
        ]),
      }),
    );
  });
});
