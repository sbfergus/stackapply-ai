"use client";

import { createPortal } from "react-dom";

interface HeaderActionsProps {
  children: React.ReactNode;
}

export function HeaderActions({ children }: HeaderActionsProps) {
  const container = typeof window !== "undefined" 
    ? document.getElementById("header-actions") 
    : null;

  if (!container) return null;

  return createPortal(children, container);
}
