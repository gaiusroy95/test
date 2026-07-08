import { useEffect, useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { tenantApi } from "@/api/client";
import { useModulesStore } from "@/store/modules";
import { PageHeader, LoadingSkeleton, EmptyState } from "@/components/shared/PageComponents";
import { toast } from "sonner";
import {
  Download, FileSearch, Paperclip, FileSpreadsheet, Archive,
} from "lucide-react";
import type { DocumentExplorerItem, Location, KPI, Indicator, ReportingYear } from "@/types";
import { formatDate, getApiError } from "@/lib/utils";

// ── Status pill ───────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  DRAFT:     "bg-slate-100 text-slate-600 border-slate-200",
  SUBMITTED: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED:  "bg-red-50 text-red-700 border-red-200",
};

function StatusPill({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] || "bg-slate-100 text-slate-500 border-slate-200";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
      {status}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DocumentExplorerPage() {
  const modules = useModulesStore((s) => s.modules);
  // Filter source data
  const [locations, setLocations]         = useState<Location[]>([]);
  const [reportingYears, setReportingYears] = useState<ReportingYear[]>([]);
  const [kpis, setKpis]                   = useState<KPI[]>([]);
  const [indicators, setIndicators]       = useState<Indicator[]>([]);

  // Selected filters
  const [selLocation, setSelLocation]   = useState("");
  const [selYear, setSelYear]           = useState("");
  const [selModule, setSelModule]       = useState("");
  const [selKpiOrInd, setSelKpiOrInd]   = useState("");

  // Data
  const [docs, setDocs]         = useState<DocumentExplorerItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  // ── Load filter options ───────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      tenantApi.listLocations({ size: 500 }),
      tenantApi.listReportingYears(),
      tenantApi.listKPIs({ size: 500 }),
      tenantApi.listIndicators(),
    ])
      .then(([locR, yrR, kpiR, indR]) => {
        setLocations(locR.data?.items || locR.data || []);
        const ryArr: ReportingYear[] = Array.isArray(yrR.data) ? yrR.data : yrR.data?.items || [];
        setReportingYears(ryArr);
        setKpis(Array.isArray(kpiR.data) ? kpiR.data : kpiR.data?.items || []);
        setIndicators(Array.isArray(indR.data) ? indR.data : indR.data?.items || []);
      })
      .catch((err: any) => toast.error(getApiError(err, "Failed to load filter options")));
  }, []);

  const filteredKPIs = useMemo(
    () => selModule ? kpis.filter((k) => k.module_id === Number(selModule)) : kpis,
    [kpis, selModule],
  );
  const filteredIndicators = useMemo(
    () => selModule ? indicators.filter((i) => i.module_id === Number(selModule)) : indicators,
    [indicators, selModule],
  );

  useEffect(() => { setSelKpiOrInd(""); }, [selModule]);

  // ── Fetch documents ───────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setSelected(new Set());
    const params: Record<string, unknown> = {};
    if (selLocation) params.location_id = selLocation;
    if (selYear)     params.year_id = Number(selYear);
    if (selModule)   params.module_id = Number(selModule);
    if (selKpiOrInd.startsWith("kpi:")) params.kpi_id = selKpiOrInd.slice(4);
    else if (selKpiOrInd.startsWith("ind:")) params.indicator_id = Number(selKpiOrInd.slice(4));

    tenantApi
      .exploreDocuments(params)
      .then((r) => setDocs(r.data))
      .catch((err: any) => toast.error(getApiError(err, "Failed to load documents")))
      .finally(() => setLoading(false));
  }, [selLocation, selYear, selModule, selKpiOrInd]);

  // ── Selection ─────────────────────────────────────────────────────────────
  const allSelected = docs.length > 0 && selected.size === docs.length;
  const toggleAll   = () => setSelected(allSelected ? new Set() : new Set(docs.map((d) => d.document_id)));
  const toggleOne   = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // ── Download single ───────────────────────────────────────────────────────
  const handleDownload = async (docId: string, fileName: string) => {
    try {
      const res = await tenantApi.downloadDocument(docId);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Download failed"); }
  };

  // ── Bulk ZIP (selected or all) ────────────────────────────────────────────
  const handleZipDownload = async (ids: string[], label: string) => {
    if (ids.length === 0) return;
    setDownloading(true);
    try {
      const res = await tenantApi.bulkDownloadDocuments(ids);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = "documents.zip"; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${ids.length} document(s) as ZIP`);
    } catch (err: any) {
      toast.error(getApiError(err, "ZIP download failed"));
    } finally {
      setDownloading(false);
    }
  };

  // ── Export Excel ───────────────────────────────────────────────────────────
  const handleExportXLS = () => {
    const rows = docs.map((d) => ({
      "Location":        d.location_name,
      "Financial Year":  `FY ${d.fy_label}`,
      "Month":           d.month_name,
      "Module":          d.module_name || "",
      "Indicator / KPI": d.kpi_name || d.indicator_name || "",
      "Value":           d.quantity ?? "",
      "Unit":            d.unit || "",
      "Status":          d.submission_status,
      "File Name":       d.file_name,
      "Submitted By":    d.uploaded_by_name || "",
      "Submitted On":    formatDate(d.uploaded_at),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Documents");
    XLSX.writeFile(wb, "document-register.xlsx");
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const selectCls =
    "h-9 px-3 rounded-lg border border-slate-200 bg-white text-[13px] text-brand-navy " +
    "font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/30 focus:border-brand-accent transition-colors";

  return (
    <div className="p-6 space-y-4 max-w-[1500px] mx-auto">
      <PageHeader
        title="Document Explorer"
        description="Browse and download supporting documents across all locations"
        breadcrumb={[{ label: "Company Portal", href: "/app" }, { label: "Documents" }]}
      />

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <select value={selLocation} onChange={(e) => setSelLocation(e.target.value)} className={selectCls} style={{ minWidth: 170 }}>
          <option value="">All Locations</option>
          {locations.map((l) => <option key={l.location_id} value={l.location_id}>{l.location_name}</option>)}
        </select>

        <select value={selYear} onChange={(e) => setSelYear(e.target.value)} className={selectCls} style={{ minWidth: 130 }}>
          <option value="">All FY</option>
          {reportingYears.map((ry) => (
            <option key={ry.year_id} value={ry.year_id}>FY {ry.financial_year?.fy_label || ry.year_id}</option>
          ))}
        </select>

        <select value={selModule} onChange={(e) => setSelModule(e.target.value)} className={selectCls} style={{ minWidth: 130 }}>
          <option value="">All Modules</option>
          {modules.map((m) => <option key={m.module_id} value={m.module_id}>{m.module_name}</option>)}
        </select>

        <select value={selKpiOrInd} onChange={(e) => setSelKpiOrInd(e.target.value)} className={selectCls} style={{ minWidth: 200 }}>
          <option value="">All KPIs &amp; Indicators</option>
          {filteredKPIs.length > 0 && (
            <optgroup label="KPIs">
              {filteredKPIs.map((k) => <option key={k.kpi_id} value={`kpi:${k.kpi_id}`}>{k.kpi_name} ({k.unit})</option>)}
            </optgroup>
          )}
          {filteredIndicators.length > 0 && (
            <optgroup label="Indicators">
              {filteredIndicators.map((ind) => <option key={ind.indicator_id} value={`ind:${ind.indicator_id}`}>{ind.indicator_name}</option>)}
            </optgroup>
          )}
        </select>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      {!loading && docs.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[13px] text-slate-500">
            <Paperclip size={13} />
            {docs.length} document{docs.length !== 1 ? "s" : ""}
          </span>

          <div className="flex-1" />

          {/* Export Excel */}
          <button
            onClick={handleExportXLS}
            className="flex items-center gap-2 px-3.5 h-9 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            <FileSpreadsheet size={15} className="text-emerald-600" />
            Export Excel
          </button>

          {/* Download selected ZIP */}
          {selected.size > 0 && (
            <button
              onClick={() => handleZipDownload(Array.from(selected), "selected")}
              disabled={downloading}
              className="flex items-center gap-2 px-3.5 h-9 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50"
            >
              <Archive size={15} className="text-brand-accent" />
              Download Selected ({selected.size}) ZIP
            </button>
          )}

          {/* Download all ZIP */}
          <button
            onClick={() => handleZipDownload(docs.map((d) => d.document_id), "all")}
            disabled={downloading}
            className="flex items-center gap-2 px-3.5 h-9 rounded-lg bg-brand-accent text-white text-[13px] font-semibold hover:bg-brand-accentDk disabled:opacity-50 transition-colors"
          >
            <Archive size={15} />
            {downloading ? "Downloading…" : "Download All ZIP"}
          </button>
        </div>
      )}

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {loading && <LoadingSkeleton rows={8} cols={6} />}

      {/* ── Empty ────────────────────────────────────────────────────────── */}
      {!loading && docs.length === 0 && (
        <EmptyState
          icon={FileSearch}
          title="No documents found"
          description="Try adjusting your filters or upload documents from the ESG Input page."
        />
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {!loading && docs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-100 bg-slate-50/60">
                  {/* Checkbox */}
                  <th className="px-4 py-3 w-9">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="accent-brand-accent cursor-pointer"
                    />
                  </th>
                  {[
                    "Location", "Financial Year", "Month", "Module",
                    "Indicator / KPI", "Value", "Unit", "Status",
                    "File Name", "Submitted By", "Submitted On", "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-3 text-slate-500 font-semibold text-[11px] uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {docs.map((doc) => (
                  <tr
                    key={doc.document_id}
                    className={`border-b border-slate-100 transition-colors ${
                      selected.has(doc.document_id) ? "bg-sky-50/50" : "hover:bg-slate-50/50"
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3 w-9">
                      <input
                        type="checkbox"
                        checked={selected.has(doc.document_id)}
                        onChange={() => toggleOne(doc.document_id)}
                        className="accent-brand-accent cursor-pointer"
                      />
                    </td>

                    <td className="px-3 py-3 font-medium text-brand-navy whitespace-nowrap">{doc.location_name}</td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">FY {doc.fy_label}</td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{doc.month_name}</td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{doc.module_name || "—"}</td>

                    {/* Indicator / KPI */}
                    <td className="px-3 py-3 max-w-[200px]">
                      <span className="text-slate-700 block truncate" title={doc.kpi_name || doc.indicator_name || ""}>
                        {doc.kpi_name || doc.indicator_name || <span className="text-slate-400 italic">Submission level</span>}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-slate-600 text-right whitespace-nowrap">
                      {doc.quantity != null ? doc.quantity : "—"}
                    </td>
                    <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{doc.unit || "—"}</td>

                    <td className="px-3 py-3 whitespace-nowrap">
                      <StatusPill status={doc.submission_status} />
                    </td>

                    {/* File name */}
                    <td className="px-3 py-3 max-w-[160px]">
                      <span className="text-slate-700 font-medium block truncate" title={doc.file_name}>
                        {doc.file_name}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{doc.uploaded_by_name || "—"}</td>
                    <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{formatDate(doc.uploaded_at)}</td>

                    {/* Download */}
                    <td className="px-3 py-3">
                      <button
                        onClick={() => handleDownload(doc.document_id, doc.file_name)}
                        title="Download file"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 text-[12px] text-slate-600 hover:bg-sky-50 hover:border-brand-accent hover:text-brand-accent transition-colors whitespace-nowrap"
                      >
                        <Download size={13} /> Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
