"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const SpacesClient = dynamic(() => import("./spaces-client"), { ssr: false });

export default function SpacesPage() {
  return (
    <Suspense fallback={null}>
      <SpacesClient />
    </Suspense>
  );
}
