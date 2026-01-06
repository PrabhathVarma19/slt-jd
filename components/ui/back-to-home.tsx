"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";

export function BackToHome({
  href = "/",
  className,
  label = "Back to Home",
}: {
  href?: string;
  className?: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline",
        className
      )}
    >
      <ChevronLeft className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
}


