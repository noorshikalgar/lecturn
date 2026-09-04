import type { Collection } from "@lecturn/shared";
import { Layers } from "lucide-react";
import { Link } from "react-router-dom";
import { CoursePlaceholder } from "./CoursePlaceholder";

// Shares CourseCard's exact visual shape (same aspect-video cover area, same
// title/meta layout) so the two interleave in a grid without one looking
// out of place — the only real differences are the stack icon standing in
// for a cover image and the destination route.
export function CollectionCard({ collection }: { collection: Collection }) {
  const count = collection.courses?.length;
  return (
    <Link to={`/collections/${collection.id}`} className="block overflow-hidden rounded-[10px] border border-border bg-card">
      <div className="relative aspect-video w-full overflow-hidden">
        <CoursePlaceholder />
        <span className="absolute left-2 top-2 flex size-6 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm">
          <Layers size={13} />
        </span>
      </div>
      <div className="p-4">
        <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wide text-primary">Collection</p>
        <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-[14.5px] font-semibold leading-[1.35] tracking-tight text-foreground">
          {collection.title}
        </p>
        <p className="mt-1 truncate text-[12.5px] text-muted-foreground">
          {typeof count === "number" ? `${count} course${count === 1 ? "" : "s"}` : "Collection"}
        </p>
      </div>
    </Link>
  );
}
