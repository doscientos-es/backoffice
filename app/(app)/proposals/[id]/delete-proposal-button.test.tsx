import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const duplicate = vi.fn();
const onDelete = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../actions", () => ({
  deleteProposal: vi.fn(),
  duplicateProposal: (...args: unknown[]) => duplicate(...args),
  restoreProposal: vi.fn(),
}));
vi.mock("@/lib/hooks/use-undoable-delete", () => ({
  useUndoableDelete: () => ({ run: onDelete, pending: false }),
}));

import { ProposalMoreActions } from "./delete-proposal-button";

describe("ProposalMoreActions", () => {
  beforeEach(() => {
    push.mockReset();
    duplicate.mockReset();
    onDelete.mockReset();
    duplicate.mockResolvedValue({ ok: true, id: "duplicated-proposal" });
  });

  it("keeps secondary actions inside the overflow menu", async () => {
    render(<ProposalMoreActions proposalId="proposal-1" />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Más acciones de la propuesta" }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicar" }));

    await waitFor(() => expect(duplicate).toHaveBeenCalledWith({ id: "proposal-1" }));
    expect(push).toHaveBeenCalledWith("/proposals/duplicated-proposal");

    fireEvent.pointerDown(screen.getByRole("button", { name: "Más acciones de la propuesta" }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "Eliminar" }));
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
