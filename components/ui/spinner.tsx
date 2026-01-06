"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export function Spinner({
  className,
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span className="inline-flex items-center" aria-label={label} role="status">
      <span
        className={cn(
          "h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
          className
        )}
      />
    </span>
  );
}


