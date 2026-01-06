"use client";

import * as React from "react";
import { AlertTriangle, Info } from "lucide-react";

import { cn } from "@/lib/utils";

type ErrorBarVariant = "error" | "info";

export function ErrorBar({
  message,
  variant = "error",
  className,
}: {
  message: string;
  variant?: ErrorBarVariant;
  className?: string;
}) {
  const Icon = variant === "error" ? AlertTriangle : Info;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl px-3 py-2 text-sm",
        variant === "error"
          ? "bg-red-50 text-red-800"
          : "bg-slate-50 text-slate-800",
        className
      )}
      role={variant === "error" ? "alert" : "status"}
    >
      <Icon className="mt-0.5 h-4 w-4 flex-none opacity-80" />
      <span className="leading-snug">{message}</span>
    </div>
  );
}


