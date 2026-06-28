import * as React from "react";
import { cn } from "./cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-base outline-none",
        "focus:border-brand-400 focus:ring-1 focus:ring-brand-400 disabled:bg-neutral-100",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base outline-none",
        "focus:border-brand-400 focus:ring-1 focus:ring-brand-400",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-base outline-none",
        "focus:border-brand-400 focus:ring-1 focus:ring-brand-400",
        className,
      )}
      {...props}
    />
  ),
);
Select.displayName = "Select";
