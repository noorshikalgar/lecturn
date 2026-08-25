import type { CourseTreeNode } from "@lecturn/shared";
import { useQuery } from "@tanstack/react-query";
import { Download, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { getNodeContent } from "../../lib/api/nodes";
import { getPreviewKind } from "../../lib/previewableFile";
import { ApiError } from "../../lib/apiClient";

const markdownComponents = {
  h1: (p: React.ComponentProps<"h1">) => <h1 className="mb-3 mt-5 text-xl font-semibold text-slate-100 first:mt-0" {...p} />,
  h2: (p: React.ComponentProps<"h2">) => <h2 className="mb-2 mt-5 text-lg font-semibold text-slate-100 first:mt-0" {...p} />,
  h3: (p: React.ComponentProps<"h3">) => <h3 className="mb-2 mt-4 text-base font-semibold text-slate-100 first:mt-0" {...p} />,
  p: (p: React.ComponentProps<"p">) => <p className="mb-3 text-sm leading-relaxed text-slate-300" {...p} />,
  a: (p: React.ComponentProps<"a">) => <a className="text-slate-100 underline hover:text-white" target="_blank" rel="noreferrer" {...p} />,
  ul: (p: React.ComponentProps<"ul">) => <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-slate-300" {...p} />,
  ol: (p: React.ComponentProps<"ol">) => <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-slate-300" {...p} />,
  li: (p: React.ComponentProps<"li">) => <li {...p} />,
  code: (p: React.ComponentProps<"code">) => <code className="rounded bg-slate-800 px-1 py-0.5 font-mono text-xs text-slate-200" {...p} />,
  pre: (p: React.ComponentProps<"pre">) => <pre className="mb-3 overflow-x-auto rounded-md bg-slate-800 p-3 text-xs text-slate-200" {...p} />,
  blockquote: (p: React.ComponentProps<"blockquote">) => (
    <blockquote className="mb-3 border-l-2 border-slate-700 pl-3 text-sm italic text-slate-400" {...p} />
  ),
  hr: () => <hr className="my-4 border-slate-800" />,
  strong: (p: React.ComponentProps<"strong">) => <strong className="font-semibold text-slate-100" {...p} />,
  img: (p: React.ComponentProps<"img">) => <img className="my-3 max-w-full rounded-md" {...p} />,
};

function TextOrMarkdownBody({ nodeId, kind }: { nodeId: number; kind: "text" | "markdown" }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["node-content", nodeId],
    queryFn: () => getNodeContent(nodeId),
  });

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-400">{error instanceof ApiError ? error.message : "Couldn't load this file."}</p>;
  if (!data) return null;

  if (kind === "markdown") {
    return (
      <div className="mx-auto max-w-3xl">
        <ReactMarkdown components={markdownComponents}>{data.content}</ReactMarkdown>
      </div>
    );
  }

  return <pre className="mx-auto max-w-3xl whitespace-pre-wrap break-words font-mono text-xs text-slate-300">{data.content}</pre>;
}

export function FilePreviewPane({ node, onClose }: { node: CourseTreeNode; onClose: () => void }) {
  const kind = getPreviewKind(node.rawName);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-6 py-3">
        <h1 className="truncate text-lg font-semibold text-slate-50">{node.title}</h1>
        <div className="flex shrink-0 items-center gap-1">
          <a
            href={`/api/nodes/${node.id}/download`}
            title="Download"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
          >
            <Download size={16} />
          </a>
          <button onClick={onClose} title="Close" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {kind === "pdf" ? (
          <iframe src={`/api/nodes/${node.id}/inline`} title={node.title} className="h-full w-full border-0" />
        ) : kind ? (
          <div className="px-6 py-6">
            <TextOrMarkdownBody nodeId={node.id} kind={kind} />
          </div>
        ) : (
          <p className="px-6 py-6 text-sm text-slate-500">This file type can't be previewed here.</p>
        )}
      </div>
    </div>
  );
}
