import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-semibold">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

const control =
  "h-11 w-full rounded-md border border-line bg-sunken px-3 outline-none ring-amber/40 placeholder:text-muted focus:ring-2";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(control, props.className)} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(control, props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(control, "min-h-24 py-2", props.className)} />;
}

export function FormNote({ error, ok }: { error?: string; ok?: string }) {
  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (ok) return <p className="text-sm text-ok">{ok}</p>;
  return null;
}
