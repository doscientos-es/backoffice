"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./button";

interface Props {
  children: ReactNode;
  /** Fallback inline pequeño para drawers/dialogs. Si no se pasa se usa el default. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * ErrorBoundary de cliente para proteger drawers, dialogs y otras piezas
 * interactivas. Evita que un error en el contenido crashee toda la página.
 *
 * Uso:
 *   <ErrorBoundary>
 *     <MiComponenteQuePodriaFallar />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // En producción aquí podría ir un servicio de logging (Sentry, etc.)
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  override render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (error) {
      if (fallback) return fallback(error, this.reset);
      return <DefaultFallback error={error} reset={this.reset} />;
    }

    return children;
  }
}

function DefaultFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10">
        <AlertTriangle className="size-5 text-destructive" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Algo ha salido mal</p>
        <p className="text-xs text-muted-foreground">
          No se ha podido cargar este contenido.
        </p>
        {process.env.NODE_ENV === "development" && (
          <p className="mt-1 max-w-xs truncate text-[11px] text-muted-foreground/60">
            {error.message}
          </p>
        )}
      </div>
      <Button size="sm" variant="outline" onClick={reset}>
        <RefreshCw className="size-3.5" />
        Reintentar
      </Button>
    </div>
  );
}
