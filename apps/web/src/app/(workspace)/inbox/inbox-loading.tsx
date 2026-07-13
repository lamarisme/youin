import { ProductList, ProductListItem } from "@/components/product-list";
import { ShimmerBar } from "@/components/shimmer-bar";
import { cn } from "@/lib/utils";

const SKELETON_WIDTHS = ["w-2/3", "w-3/5", "w-4/5", "w-1/2", "w-3/4"];

export function InboxListSkeleton() {
  return (
    <ProductList aria-label="Loading inbox activity" aria-busy="true">
      {SKELETON_WIDTHS.map((width, index) => (
        <ProductListItem key={width} interactive={false} className="px-4 py-3 sm:py-2.5">
          <div className="flex items-start gap-3">
            <ShimmerBar className="mt-2 size-2 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-4">
                <ShimmerBar className={cn("h-3.5 rounded-sm", width)} />
                <ShimmerBar className="h-3 w-16 shrink-0 rounded-sm" />
              </div>
              <div className="flex items-center gap-2">
                <ShimmerBar className="size-5 shrink-0 rounded-full" />
                <ShimmerBar
                  className={cn("h-3 rounded-sm", index % 2 === 0 ? "w-44" : "w-36")}
                />
              </div>
            </div>
          </div>
        </ProductListItem>
      ))}
    </ProductList>
  );
}
