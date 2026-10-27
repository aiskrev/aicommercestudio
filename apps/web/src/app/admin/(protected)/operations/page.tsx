"use client";

import { Suspense } from "react";

import { Operations } from "@/components/admin/Operations";
import { LoadingState } from "@/components/admin/ui";

export default function AdminOperationsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Operations />
    </Suspense>
  );
}
