import type { CourseTreeNode } from "@lecturn/shared";
import { Download, ExternalLink, FileText } from "lucide-react";
import { flattenResources } from "../../lib/courseTree";
import { isPreviewableFile } from "../../lib/previewableFile";

interface ResourcesPanelProps {
  nodes: CourseTreeNode[];
  onPreviewFile: (node: CourseTreeNode) => void;
}

export function ResourcesPanel({ nodes, onPreviewFile }: ResourcesPanelProps) {
  const resources = flattenResources(nodes);

  if (resources.length === 0) {
    return <p className="text-sm text-muted-foreground">No downloadable resources or links in this course.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {resources.map((node) => {
        if (node.type === "file" && isPreviewableFile(node.rawName)) {
          return (
            <li key={node.id}>
              <button
                onClick={() => onPreviewFile(node)}
                className="flex w-full items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-2 text-left text-sm text-muted-foreground hover:border-border hover:text-foreground"
              >
                <FileText size={14} />
                <span className="flex-1 truncate">{node.title}</span>
              </button>
            </li>
          );
        }
        return (
          <li key={node.id}>
            <a
              href={node.type === "link" ? (node.targetUrl ?? undefined) : `/api/nodes/${node.id}/download`}
              target={node.type === "link" ? "_blank" : undefined}
              rel={node.type === "link" ? "noreferrer" : undefined}
              className="flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-2 text-sm text-muted-foreground hover:border-border hover:text-foreground"
            >
              {node.type === "link" ? <ExternalLink size={14} /> : <Download size={14} />}
              <span className="flex-1 truncate">{node.title}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
