import { Toaster as Sonner, type ToasterProps } from "sonner";

// Renders the globally styled toast container.
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      toastOptions={{
        classNames: {
          toast:
            "border border-slate-200 bg-white text-slate-900 shadow-lg shadow-slate-900/10",
          description: "text-slate-600",
          actionButton: "bg-slate-900 text-white",
          cancelButton: "bg-slate-100 text-slate-900",
        },
      }}
      {...props}
    />
  );
}
