/**
 * Scope3CSVImport — CSV file upload + preview for Scope 3 batch entries.
 * Uploads via the existing /scope3/batches/{batchId}/upload endpoint.
 */
import { useRef, useState } from "react";
import { Upload, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { tenantApi } from "@/api/client";
import { getApiError } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Props {
  batchId: string;
  onUploaded: () => void;    // callback to refresh entries after upload
  disabled?: boolean;
}

export default function Scope3CSVImport({ batchId, onUploaded, disabled }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    total_rows: number;
    valid_rows: number;
    error_rows: number;
    total_emissions: number | null;
    errors: { row: number; message: string }[];
  } | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await tenantApi.uploadScope3CSV(batchId, file);
      setResult(res.data);
      if (res.data.error_rows > 0) {
        toast.warning(`Uploaded with ${res.data.error_rows} error(s)`);
      } else {
        toast.success(`${res.data.valid_rows} rows imported`);
      }
      onUploaded();
    } catch (err: any) {
      toast.error(getApiError(err, "CSV upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="mt-3">
      <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />

      {!file ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="text-[12px] gap-1.5"
        >
          <Upload size={13} /> Import CSV
        </Button>
      ) : (
        <div className="border border-border rounded-md p-3 bg-sunken">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] text-foreground font-medium">{file.name}</span>
            <button onClick={reset} className="text-muted-foreground hover:text-muted-foreground">
              <X size={14} />
            </button>
          </div>

          {result ? (
            <div className="text-[12px] space-y-1">
              <div className="flex items-center gap-1.5 text-ok">
                <CheckCircle2 size={13} /> {result.valid_rows} valid rows
              </div>
              {result.error_rows > 0 && (
                <div className="flex items-center gap-1.5 text-destructive">
                  <AlertCircle size={13} /> {result.error_rows} errors
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="mt-1 max-h-[100px] overflow-y-auto text-[11px] text-destructive space-y-0.5">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <div key={i}>Row {e.row}: {e.message}</div>
                  ))}
                  {result.errors.length > 10 && (
                    <div className="text-muted-foreground">... and {result.errors.length - 10} more</div>
                  )}
                </div>
              )}
              <Button variant="outline" size="sm" onClick={reset} className="text-[11px] mt-2">
                Upload another
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={handleUpload}
              disabled={uploading}
              className="text-[12px] gap-1.5"
            >
              {uploading ? "Uploading..." : "Confirm Upload"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
