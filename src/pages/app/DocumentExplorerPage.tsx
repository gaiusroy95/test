import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { tenantApi } from "@/api/client";
import { useModulesStore } from "@/store/modules";
import { PageShell } from "@/components/shared/PageShell";
import { DataTable } from "@/components/shared/DataTable";
import { FilterBar, FilterSelect } from "@/components/shared/FilterBar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Download, FileSearch, Paperclip, FileSpreadsheet, Archive, Plus,
} from "lucide-react";
import type { DocumentExplorerItem, Location, KPI, Indicator, ReportingYear } from "@/types";
import { formatDate, getApiError } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  DRAFT:     "bg-sunken text-muted-foreground border-border",
  SUBMITTED: "bg-warn-tint text-warn border-warn/30",
  APPROVED:  "bg-ok-tint text-ok border-ok/30",
  REJECTED:  "bg-destructive-tint text-destructive border-destructive/30",
};

function StatusPill({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] || "bg-sunken text-muted-foreground border-border";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
      {status}
    </span>
  );
}

export default function DocumentExplorerPage() {
  const navigate = useNavigate();
  const modules = useModulesStore((s) => s.modules);

  const [locations, setLocations] = useState<Location[]>([]);
  const [reportingYears, setReportingYears] = useState<ReportingYear[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);

  const [selLocation, setSelLocation] = useState("");
  const [selYear, setSelYear] = useState("");
  const [selModule, setSelModule] = useState("");
  const [selKpiOrInd, setSelKpiOrInd] = useState("");

  const [docs, setDocs] = useState<DocumentExplorerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

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
      .catch((err: unknown) => toast.error(getApiError(err, "Failed to load filter options")));
  }, []);

  const filteredKPIs = useMemo(
    () => (selModule ? kpis.filter((k) => k.module_id === Number(selModule)) : kpis),
    [kpis, selModule],
  );
  const filteredIndicators = useMemo(
    () => (selModule ? indicators.filter((i) => i.module_id === Number(selModule)) : indicators),
    [indicators, selModule],
  );

  useEffect(() => { setSelKpiOrInd(""); }, [selModule]);

  useEffect(() => {
    setLoading(true);
    setSelected(new Set());
    const params: Record<string, unknown> = {};
    if (selLocation) params.location_id = selLocation;
    if (selYear) params.year_id = Number(selYear);
    if (selModule) params.module_id = Number(selModule);
    if (selKpiOrInd.startsWith("kpi:")) params.kpi_id = selKpiOrInd.slice(4);
    else if (selKpiOrInd.startsWith("ind:")) params.indicator_id = Number(selKpiOrInd.slice(4));

    tenantApi
      .exploreDocuments(params)
      .then((r) => {
        const data = r.data;
        setDocs(Array.isArray(data) ? data : data?.items ?? []);
      })
      .catch((err: unknown) => {
        toast.error(getApiError(err, "Failed to load documents"));
        setDocs([]);
      })
      .finally(() => setLoading(false));
  }, [selLocation, selYear, selModule, selKpiOrInd]);

  const allSelected = docs.length > 0 && selected.size === docs.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(docs.map((d) => d.document_id)));
  const toggleOne = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleDownload = async (docId: string, fileName: string) => {
    try {
      const res = await tenantApi.downloadDocument(docId);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Download failed"); }
  };

  const handleZipDownload = async (ids: string[]) => {
    if (ids.length === 0) return;
    setDownloading(true);
    try {
      const res = await tenantApi.bulkDownloadDocuments(ids);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = "documents.zip"; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${ids.length} document(s) as ZIP`);
    } catch (err: unknown) {
      toast.error(getApiError(err, "ZIP download failed"));
    } finally {
      setDownloading(false);
    }
  };

  const handleExportXLS = () => {
    const rows = docs.map((d) => ({
      Location: d.location_name,
      "Financial Year": `FY ${d.fy_label}`,
      Month: d.month_name,
      Module: d.module_name || "",
      "Indicator / KPI": d.kpi_name || d.indicator_name || "",
      Value: d.quantity ?? "",
      Unit: d.unit || "",
      Status: d.submission_status,
      "File Name": d.file_name,
      "Submitted By": d.uploaded_by_name || "",
      "Submitted On": formatDate(d.uploaded_at),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Documents");
    XLSX.writeFile(wb, "document-register.xlsx");
  };

  const goUpload = () => navigate("/app/esg-input");

  const hasFilters = !!(selLocation || selYear || selModule || selKpiOrInd);

  const explorerFilters = (
    <FilterBar
      showClear={hasFilters}
      onClear={() => { setSelLocation(""); setSelYear(""); setSelModule(""); setSelKpiOrInd(""); }}
      className="gap-3 flex-1 min-w-0"
    >
      <FilterSelect
        label="Location"
        value={selLocation}
        onChange={setSelLocation}
        placeholder="All Locations"
        minWidth={170}
        options={locations.map((l) => ({ value: l.location_id, label: l.location_name }))}
      />
      <FilterSelect
        label="Financial Year"
        value={selYear}
        onChange={setSelYear}
        placeholder="All FY"
        minWidth={130}
        options={reportingYears.map((ry) => ({
          value: String(ry.year_id),
          label: `FY ${ry.financial_year?.fy_label || ry.year_id}`,
        }))}
      />
      <FilterSelect
        label="Module"
        value={selModule}
        onChange={setSelModule}
        placeholder="All Modules"
        minWidth={140}
        options={modules.map((m) => ({ value: String(m.module_id), label: m.module_name }))}
      />
      <div className="flex items-center gap-1.5 min-w-0" style={{ minWidth: 200 }}>
        <Label className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap shrink-0">
          KPI / Indicator
        </Label>
        <Select
          value={selKpiOrInd || "__all__"}
          onValueChange={(v) => setSelKpiOrInd(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="h-8 text-xs flex-1 min-w-0">
            <SelectValue placeholder="All KPIs & Indicators" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All KPIs & Indicators</SelectItem>
            {filteredKPIs.length > 0 && (
              <SelectGroup>
                <SelectLabel>KPIs</SelectLabel>
                {filteredKPIs.map((k) => (
                  <SelectItem key={k.kpi_id} value={`kpi:${k.kpi_id}`}>
                    {k.kpi_name} ({k.unit})
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {filteredIndicators.length > 0 && (
              <SelectGroup>
                <SelectLabel>Indicators</SelectLabel>
                {filteredIndicators.map((ind) => (
                  <SelectItem key={ind.indicator_id} value={`ind:${ind.indicator_id}`}>
                    {ind.indicator_name}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
      </div>
    </FilterBar>
  );

  return (
    <PageShell
      title="Document Explorer"
      description="Browse and download supporting documents across all locations"
      breadcrumb={[{ label: "Home", href: "/app" }, { label: "Documents" }]}
      actions={
        <Button size="sm" onClick={goUpload}>
          <Plus size={14} /> Upload Document
        </Button>
      }
    >
      <DataTable
        toolbarPlacement="inside"
        filters={explorerFilters}
        loading={loading}
        skeletonCols={8}
        skeletonRows={8}
        empty={!loading && docs.length === 0 ? {
          icon: FileSearch,
          title: hasFilters ? "No documents match these filters" : "No documents yet",
          description: hasFilters
            ? "Try clearing filters or upload supporting files from ESG Input."
            : "Upload supporting evidence from ESG Input to build your document register.",
          children: (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <Button size="sm" onClick={goUpload}>
                <Plus size={14} /> Upload Document
              </Button>
              {hasFilters && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setSelLocation(""); setSelYear(""); setSelModule(""); setSelKpiOrInd(""); }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ),
        } : undefined}
        actions={!loading && docs.length > 0 ? (
          <>
            <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground mr-2">
              <Paperclip size={13} />
              {docs.length} document{docs.length !== 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={handleExportXLS}
              className="flex items-center gap-2 px-3.5 h-9 rounded-lg border border-border bg-card text-[13px] font-medium text-muted-foreground hover:bg-sunken hover:border-border transition-colors"
            >
              <FileSpreadsheet size={15} className="text-ok" />
              Export Excel
            </button>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={() => handleZipDownload(Array.from(selected))}
                disabled={downloading}
                className="flex items-center gap-2 px-3.5 h-9 rounded-lg border border-border bg-card text-[13px] font-medium text-muted-foreground hover:bg-sunken hover:border-border transition-colors disabled:opacity-50"
              >
                <Archive size={15} className="text-primary" />
                Download Selected ({selected.size}) ZIP
              </button>
            )}
            <button
              type="button"
              onClick={() => handleZipDownload(docs.map((d) => d.document_id))}
              disabled={downloading}
              className="flex items-center gap-2 px-3.5 h-9 rounded-lg bg-primary text-white text-[13px] font-semibold hover:bg-primary-dark disabled:opacity-50 transition-colors"
            >
              <Archive size={15} />
              {downloading ? "Downloading…" : "Download All ZIP"}
            </button>
          </>
        ) : undefined}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-9">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="accent-primary cursor-pointer"
                  aria-label="Select all documents"
                />
              </TableHead>
              {[
                "Location", "Financial Year", "Month", "Module",
                "Indicator / KPI", "Value", "Unit", "Status",
                "File Name", "Submitted By", "Submitted On", "",
              ].map((h) => (
                <TableHead key={h || "actions"} className="whitespace-nowrap">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((doc) => (
              <TableRow
                key={doc.document_id}
                className={selected.has(doc.document_id) ? "bg-info-tint/50" : undefined}
              >
                <TableCell className="w-9">
                  <input
                    type="checkbox"
                    checked={selected.has(doc.document_id)}
                    onChange={() => toggleOne(doc.document_id)}
                    className="accent-primary cursor-pointer"
                    aria-label={`Select ${doc.file_name}`}
                  />
                </TableCell>
                <TableCell className="font-medium text-foreground whitespace-nowrap">{doc.location_name}</TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">FY {doc.fy_label}</TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">{doc.month_name}</TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">{doc.module_name || "—"}</TableCell>
                <TableCell className="max-w-[200px]">
                  <span className="text-foreground/90 block truncate" title={doc.kpi_name || doc.indicator_name || ""}>
                    {doc.kpi_name || doc.indicator_name || <span className="text-muted-foreground italic">Submission level</span>}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground text-right whitespace-nowrap">
                  {doc.quantity != null ? doc.quantity : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">{doc.unit || "—"}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <StatusPill status={doc.submission_status} />
                </TableCell>
                <TableCell className="max-w-[160px]">
                  <span className="text-foreground/90 font-medium block truncate" title={doc.file_name}>
                    {doc.file_name}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">{doc.uploaded_by_name || "—"}</TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(doc.uploaded_at)}</TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => handleDownload(doc.document_id, doc.file_name)}
                    title="Download file"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[12px] text-muted-foreground hover:bg-info-tint hover:border-primary hover:text-primary transition-colors whitespace-nowrap"
                  >
                    <Download size={13} /> Download
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTable>
    </PageShell>
  );
}
