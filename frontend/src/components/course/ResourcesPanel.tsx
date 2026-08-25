import type { CourseTreeNode } from "@coursedeck/shared";
import { Download, ExternalLink, FileText } from "lucide-react";
import { useState } from "react";
import { isPreviewableTextFile } from "../../lib/previewableFile";
import { TextFilePreviewModal } from "./TextFilePreviewModal";

interface ResourcesPanelProps {
  nodes: CourseTreeNode[];
}

function flattenResources(nodes: CourseTreeNode[]): CourseTreeNode[] {
  const result: CourseTreeNode[] = [];
  for (const node of nodes) {
    if (node.type === "file" || node.type === "link") result.push(node);
    if (node.children.length > 0) result.push(...flattenResources(node.children));
  }
  return result;
}

export function ResourcesPanel({ nodes }: ResourcesPanelProps) {
  const resources = flattenResources(nodes);
  const [previewNode, setPreviewNode] = useState<CourseTreeNode | null>(null);

  if (resources.length === 0) {
    return <p className="text-sm text-slate-500">No downloadable resources or links in this course.</p>;
  }

  return (
    <>
      <ul className="space-y-1.5">
        {resources.map((node) => {
          if (node.type === "file" && isPreviewableTextFile(node.rawName)) {
            return (
              <li key={node.id}>
                <button
                  onClick={() => setPreviewNode(node)}
                  className="flex w-full items-center gap-2 rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-left text-sm text-slate-300 hover:border-slate-600 hover:text-slate-100"
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
                className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-300 hover:border-slate-600 hover:text-slate-100"
              >
                {node.type === "link" ? <ExternalLink size={14} /> : <Download size={14} />}
                <span className="flex-1 truncate">{node.title}</span>
              </a>
            </li>
          );
        })}
      </ul>
      {previewNode && (
        <TextFilePreviewModal nodeId={previewNode.id} title={previewNode.title} onClose={() => setPreviewNode(null)} />
      )}
    </>
  );
}
