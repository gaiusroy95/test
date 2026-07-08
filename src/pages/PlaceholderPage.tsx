import { Layers } from "lucide-react";

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-full p-7">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <Layers size={28} className="text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-brand-navy mb-2">{title}</h2>
        <p className="text-sm text-slate-500 max-w-sm mx-auto">
          This module is coming next. The API is ready — we just need to wire up the UI.
        </p>
      </div>
    </div>
  );
}
