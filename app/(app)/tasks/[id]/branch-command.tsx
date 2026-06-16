"use client";

import { Check, Copy, GitBranch } from "lucide-react";
import { useState } from "react";

/**
 * Displays the git command to checkout the task's feature branch with a
 * one-click copy button. Rendered client-side so the clipboard API is available.
 */
export function BranchCommand({ branch }: { branch: string }) {
  const [copied, setCopied] = useState(false);
  const cmd = `git fetch origin && git checkout ${branch}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Branch
      </p>
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
        <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
        <code className="flex-1 truncate font-mono text-xs text-foreground">{branch}</code>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copiar comando git"
          title={`Copiar: ${cmd}`}
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          {copied ? (
            <Check className="size-3.5 text-emerald-500" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Copia el comando para hacer checkout de esta branch.
      </p>
    </div>
  );
}
