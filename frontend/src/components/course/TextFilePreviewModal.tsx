import { useQuery } from "@tanstack/react-query";
import { Download, X } from "lucide-react";
import { getNodeContent } from "../../lib/api/nodes";
import { ApiError } from "../../lib/apiClient";

interface TextFilePreviewModalProps {
  nodeId: number;
  title: string;
  onClose: () => void;
}

export function TextFilePreviewModal({ nodeId, title, onClose }: TextFilePreviewModalProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["node-content", nodeId],
    queryFn: () => getNodeContent(nodeId),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border border-slate-700 bg-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="truncate text-sm font-semibold text-slate-100">{title}</h2>
          <div className="flex items-center gap-1">
            <a
              href={`/api/nodes/${nodeId}/download`}
              title="Download"
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
            >
              <Download size={15} />
            </a>
            <button onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200">
              <X size={15} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
          {error && (
            <p className="text-sm text-red-400">
              {error instanceof ApiError ? error.message : "Couldn't load this file."}
            </p>
          )}
          {data && <pre className="whitespace-pre-wrap break-words font-mono text-xs text-slate-300">{data.content}</pre>}
        </div>
      </div>
    </div>
  );
}
