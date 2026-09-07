"use client";

import { FileSpreadsheetIcon, UploadIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export function ImportDropzone({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError("Нужен файл .xlsx — выгрузка операций из интернет-банка.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Файл больше 5 МБ.");
      return;
    }

    setError(null);
    onFile(file);
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (!disabled) handleFile(event.dataTransfer.files[0]);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border px-6 py-12 text-center transition-colors",
          isDragging && "border-foreground bg-muted",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <FileSpreadsheetIcon className="size-8 text-muted-foreground" />
        <div className="space-y-1">
          <p className="font-medium">Перетащите сюда файл выписки</p>
          <p className="text-sm text-muted-foreground">
            Формат .xlsx, до 5 МБ. Ничего не сохранится, пока вы не подтвердите.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
          <UploadIcon />
          Выбрать файл
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
