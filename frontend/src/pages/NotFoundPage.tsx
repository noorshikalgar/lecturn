import { CompassIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-1 items-center px-4 py-16">
      <EmptyState
        icon={CompassIcon}
        title="Page not found"
        description="The page you're looking for doesn't exist or may have moved."
        action={
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            Back to dashboard
          </Link>
        }
      />
    </div>
  );
}
