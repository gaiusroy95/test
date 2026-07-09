import { Layers, Sparkles } from "lucide-react";

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-7 animate-page-in">
      <div className="text-center max-w-md">
        <div className="relative w-20 h-20 rounded-2xl surface-elevated flex items-center justify-center mx-auto mb-5">
          <div className="absolute inset-0 rounded-2xl brand-gradient opacity-[0.08]" />
          <Layers size={32} className="text-primary relative" />
        </div>
        <div className="inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-primary mb-2">
          <Sparkles size={12} /> Coming Soon
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2 tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          This module is on the roadmap. The API layer is ready — the enterprise UI is being built next.
        </p>
      </div>
    </div>
  );
}
