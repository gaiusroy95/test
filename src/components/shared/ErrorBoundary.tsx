import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-8">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-lg bg-destructive-tint flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} className="text-destructive" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Something went wrong</h2>
            <p className="text-ui text-muted-foreground mb-4">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <Button
              onClick={() => {
                this.setState({ hasError: false, error: undefined });
                window.location.href = "/";
              }}
            >
              <RefreshCw size={15} /> Reload App
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
