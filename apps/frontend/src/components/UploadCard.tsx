import { useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Upload, XCircle } from "lucide-react";
import type { RowFailureView } from "@repo/shared";

import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { cn } from "@repo/ui/lib/utils";
import { Spinner } from "./States";
import { downloadFile } from "@/lib/download";

export const RowErrorTable = ({ errors }: { errors: RowFailureView[] }) => (
  <div className="max-h-64 overflow-auto rounded border">
    <table className="w-full text-xs">
      <caption className="sr-only">Rows that failed validation</caption>
      <thead className="sticky top-0 bg-card">
        <tr className="border-b text-left text-muted-foreground">
          <th scope="col" className="w-16 py-1.5 px-2 font-medium">Row</th>
          <th scope="col" className="py-1.5 px-2 font-medium">Problem</th>
        </tr>
      </thead>
      <tbody>
        {errors.slice(0, 50).map((failure) => (
          <tr key={failure.row} className="border-b last:border-0">
            <td className="py-1.5 px-2 font-mono tabular-nums">{failure.row}</td>
            <td className="py-1.5 px-2">{failure.errors.join("; ")}</td>
          </tr>
        ))}
      </tbody>
    </table>
    {errors.length > 50 ? (
      <p className="px-2 py-1 text-xs text-muted-foreground">Showing the first 50 of {errors.length} invalid rows.</p>
    ) : null}
  </div>
);

export type UploadState =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "done"; inserted: number }
  | { kind: "error"; message: string; errors: RowFailureView[] };

export const UploadCard = ({
  entity,
  label,
  required,
  description,
  disabled,
  skippable,
  state,
  onUpload,
  onSkip,
}: {
  entity: string;
  label: string;
  required: boolean;
  description: string;
  disabled?: boolean;
  skippable?: boolean;
  state: UploadState;
  onUpload: (file: File) => void;
  onSkip?: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const locked = state.kind === "done";

  const choose = (file: File | undefined) => {
    if (file) onUpload(file);
  };

  return (
    <Card className={cn("gap-0 py-4", disabled && "opacity-60")}>
      <CardHeader className="px-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="size-4 text-muted-foreground" aria-hidden />
              {label}
            </CardTitle>
            <CardDescription className="mt-1 text-xs">{description}</CardDescription>
          </div>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-medium",
              required
                ? "border-critical/25 bg-critical/10 text-critical"
                : "border-border bg-muted text-muted-foreground",
            )}
          >
            {required ? "Required" : "Optional"}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 px-4">
        <div
          className={cn(
            "rounded-lg border border-dashed p-4 text-center text-sm",
            dragging && "border-primary bg-primary/5",
            disabled && "pointer-events-none",
          )}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (locked || disabled) return;
            choose(event.dataTransfer.files[0]);
          }}
        >
          {state.kind === "uploading" ? (
            <Spinner label={`Importing ${label.toLowerCase()}…`} />
          ) : state.kind === "done" ? (
            <p className="flex items-center justify-center gap-2 text-positive">
              <CheckCircle2 className="size-4" aria-hidden />
              {state.inserted} row{state.inserted === 1 ? "" : "s"} imported
            </p>
          ) : (
            <>
              <p className="text-muted-foreground">Drag and drop a .csv or .xlsx file, or</p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled || locked}
                  onClick={() => inputRef.current?.click()}
                >
                  <Upload className="size-4" aria-hidden />
                  Choose file
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void downloadFile(`/datasets/templates/${entity}?format=csv`, `${entity}-template.csv`)}
                >
                  CSV template
                </Button>
                {skippable && onSkip ? (
                  <Button type="button" size="sm" variant="ghost" onClick={onSkip}>
                    Skip
                  </Button>
                ) : null}
              </div>
            </>
          )}

          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx"
            className="sr-only"
            aria-label={`Upload ${label}`}
            disabled={disabled || locked}
            onChange={(event) => {
              choose(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>

        {state.kind === "error" ? (
          <div className="space-y-2">
            <p className="flex items-start gap-2 text-sm text-destructive">
              <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {state.message}
            </p>
            <RowErrorTable errors={state.errors} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
