import { AttachmentSection } from "@/components/ui/attachment-section";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── router stub ──────────────────────────────────────────────────────────────
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// ── helpers ──────────────────────────────────────────────────────────────────
function makeFile(name: string, type = "application/pdf") {
  return new File(["x"], name, { type });
}

const BASE_PROPS = {
  entityType: "lead" as const,
  entityId: "lead-1",
  attachments: [],
  canEdit: true,
};

// ── setup / teardown ─────────────────────────────────────────────────────────
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  mockRefresh.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// ── read-only mode ────────────────────────────────────────────────────────────
describe("read-only mode (canEdit=false)", () => {
  it("hides the file button and upload input", () => {
    render(<AttachmentSection {...BASE_PROPS} canEdit={false} />);
    expect(screen.queryByRole("button", { name: /añadir/i })).toBeNull();
    expect(document.querySelector("input[type=file]")).toBeNull();
  });

  it("shows 'Sin adjuntos.' without the drag hint", () => {
    render(<AttachmentSection {...BASE_PROPS} canEdit={false} />);
    expect(screen.getByText("Sin adjuntos.")).toBeDefined();
  });
});

// ── empty-state hint ─────────────────────────────────────────────────────────
describe("empty state with canEdit", () => {
  it("shows drag hint text", () => {
    render(<AttachmentSection {...BASE_PROPS} />);
    expect(screen.getByText(/arrastra archivos/i)).toBeDefined();
  });
});

// ── attachment list ───────────────────────────────────────────────────────────
describe("attachment list", () => {
  const items = [
    {
      id: "a1",
      name: "report.pdf",
      mime_type: "application/pdf",
      size_bytes: 2048,
      created_at: "2024-01-01",
    },
  ];

  it("renders attachment names with download links", () => {
    render(<AttachmentSection {...BASE_PROPS} attachments={items} />);
    expect(screen.getByText("report.pdf")).toBeDefined();
    const link = screen.getByRole("link", { name: /descargar/i });
    expect(link.getAttribute("href")).toBe("/api/documents/a1/download");
  });
});

// ── helper: simulate file input change ───────────────────────────────────────
function simulateFileInput(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, "files", {
    value: files,
    writable: false,
    configurable: true,
  });
  fireEvent.change(input);
}

// ── button-triggered upload ───────────────────────────────────────────────────
describe("button upload", () => {
  it("calls /api/attachments/upload and refreshes on success", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "new-id" }),
    });

    render(<AttachmentSection {...BASE_PROPS} />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    simulateFileInput(input, [makeFile("doc.pdf")]);

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("displays per-file error when upload fails", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Tipo no permitido" }),
    });

    render(<AttachmentSection {...BASE_PROPS} />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    simulateFileInput(input, [makeFile("bad.exe", "application/x-msdownload")]);

    await waitFor(() => screen.getByText(/Tipo no permitido/));
    expect(screen.getByText(/bad\.exe/)).toBeDefined();
  });

  it("uploads multiple files sequentially and collects partial errors", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "id-1" }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Demasiado grande" }) });

    render(<AttachmentSection {...BASE_PROPS} />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    simulateFileInput(input, [makeFile("a.pdf"), makeFile("b.pdf")]);

    await waitFor(() => screen.getByText(/Demasiado grande/));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // first file succeeded — no error for it
    expect(screen.queryByText(/a\.pdf/)).toBeNull();
    // second file failed — error present
    expect(screen.getByText(/b\.pdf/)).toBeDefined();
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it("shows 'Error de red' on network failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network"));

    render(<AttachmentSection {...BASE_PROPS} />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    simulateFileInput(input, [makeFile("doc.pdf")]);

    await waitFor(() => screen.getByText(/Error de red/));
  });
});

// ── drag-and-drop ─────────────────────────────────────────────────────────────
describe("drag-and-drop", () => {
  it("shows overlay on dragenter and hides on dragleave", () => {
    render(<AttachmentSection {...BASE_PROPS} />);
    const card =
      document.querySelector("[data-slot=card]") ??
      screen.getByText("Adjuntos").closest("[class]")!;

    fireEvent.dragEnter(card, { dataTransfer: { files: [] } });
    expect(screen.getByText(/suelta los archivos/i)).toBeDefined();

    fireEvent.dragLeave(card);
    expect(screen.queryByText(/suelta los archivos/i)).toBeNull();
  });

  it("uploads dropped files", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "dropped-id" }),
    });

    render(<AttachmentSection {...BASE_PROPS} />);
    const card =
      document.querySelector("[data-slot=card]") ??
      screen.getByText("Adjuntos").closest("[class]")!;

    const file = makeFile("dropped.pdf");
    fireEvent.drop(card, { dataTransfer: { files: [file] } });

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledOnce());
  });

  it("ignores drag events when canEdit is false", () => {
    render(<AttachmentSection {...BASE_PROPS} canEdit={false} />);
    const card =
      document.querySelector("[data-slot=card]") ??
      screen.getByText("Sin adjuntos.").closest("[class]")!;
    fireEvent.dragEnter(card);
    expect(screen.queryByText(/suelta los archivos/i)).toBeNull();
  });
});
