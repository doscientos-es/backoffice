// UI primitives — framework-agnostic React components ready to be extracted
// into a standalone package (@doscientos/primitives or similar).
//
// Rules that make every export here "primitive":
//   · No imports from @/app/, @/lib/ (except ../lib/utils for `cn`), or @/components/
//   · No Next.js APIs (next/link, next/navigation, next/image)
//   · No server actions, Supabase clients, or any backend calls
//   · Internal cross-references use relative paths (./ui/X)
//
// What stays in components/ui/ (not primitive — app-coupled):
//   · attachment-section  — next/link + next/navigation + upload flow
//   · autosave-indicator  — imports AutosaveStatus from lib/hooks
//   · client-avatar       — next/image
//   · client-logo-upload  — Supabase upload + next/image
//   · copy-button         — sileo toast (can be decoupled later)
//   · copy-summary-button — sileo toast + appends window.location origin
//   · date-field          — lib/utils/date-field masking logic
//   · error-boundary      — next/navigation useRouter
//   · member-avatar       — team-member domain + lib/utils memberAvatarUrl
//   · nif-input           — lib/vies/nif validation
//   · status-badge        — lib/status domain enum
//   · zip-input           — lib/address/actions server action

export * from "./ui/accordion";
export * from "./ui/ai-notice";
export * from "./ui/alert";
export * from "./ui/aspect-ratio";
export * from "./ui/avatar";
export * from "./ui/badge";
export * from "./ui/breadcrumb";
export * from "./ui/button-group";
export * from "./ui/button";
export * from "./ui/card";
export * from "./ui/checkbox";
export * from "./ui/collapsible";
export * from "./ui/combobox";
export * from "./ui/command";
export * from "./ui/confirm-dialog";
export * from "./ui/danger-zone";
export * from "./ui/dialog";
export * from "./ui/doc-preview";
export * from "./ui/drawer";
export * from "./ui/dropdown-menu";
export * from "./ui/empty-state";
export * from "./ui/entity-avatar";
export * from "./ui/entity-combobox";
export * from "./ui/entity-multi-combobox";
export * from "./ui/field";
export * from "./ui/form-feedback";
export * from "./ui/form-field";
export * from "./ui/form-row";
export * from "./ui/hover-card";
export * from "./ui/iban-input";
export * from "./ui/input-group";
export * from "./ui/input";
export * from "./ui/item";
export * from "./ui/kbd";
export * from "./ui/label";
export * from "./ui/markdown";
export * from "./ui/menubar";
export * from "./ui/password-strength";
export * from "./ui/popover";
export * from "./ui/select";
export * from "./ui/separator";
export * from "./ui/skeleton";
export * from "./ui/submit-button";
export * from "./ui/switch";
export * from "./ui/table";
export * from "./ui/textarea";
export * from "./lib/utils";
