import type { CourseTreeNode } from "@lecturn/shared";
import { useQuery } from "@tanstack/react-query";
import { Download, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { getNodeContent } from "../../lib/api/nodes";
import { getPreviewKind } from "../../lib/previewableFile";
import { ApiError } from "../../lib/apiClient";

const markdownComponents = {
  h1: (p: React.ComponentProps<"h1">) => <h1 className="mb-3 mt-5 text-xl font-semibold text-foreground first:mt-0" {...p} />,
  h2: (p: React.ComponentProps<"h2">) => <h2 className="mb-2 mt-5 text-lg font-semibold text-foreground first:mt-0" {...p} />,
  h3: (p: React.ComponentProps<"h3">) => <h3 className="mb-2 mt-4 text-base font-semibold text-foreground first:mt-0" {...p} />,
  p: (p: React.ComponentProps<"p">) => <p className="mb-3 text-sm leading-relaxed text-muted-foreground" {...p} />,
  a: (p: React.ComponentProps<"a">) => <a className="text-foreground underline hover:text-white" target="_blank" rel="noreferrer" {...p} />,
  ul: (p: React.ComponentProps<"ul">) => <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground" {...p} />,
  ol: (p: React.ComponentProps<"ol">) => <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground" {...p} />,
  li: (p: React.ComponentProps<"li">) => <li {...p} />,
  code: (p: React.ComponentProps<"code">) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground" {...p} />,
  pre: (p: React.ComponentProps<"pre">) => <pre className="mb-3 overflow-x-auto rounded-md bg-muted p-3 text-xs text-foreground" {...p} />,
  blockquote: (p: React.ComponentProps<"blockquote">) => (
    <blockquote className="mb-3 border-l-2 border-border pl-3 text-sm italic text-muted-foreground" {...p} />
  ),
  hr: () => <hr className="my-4 border-border" />,
  strong: (p: React.ComponentProps<"strong">) => <strong className="font-semibold text-foreground" {...p} />,
  img: (p: React.ComponentProps<"img">) => <img className="my-3 max-w-full rounded-md" {...p} />,
};

function TextOrMarkdownBody({ nodeId, kind }: { nodeId: string; kind: "text" | "markdown" }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["node-content", nodeId],
    queryFn: () => getNodeContent(nodeId),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{error instanceof ApiError ? error.message : "Couldn't load this file."}</p>;
  if (!data) return null;

  if (kind === "markdown") {
    return (
      <div className="mx-auto max-w-3xl">
        <ReactMarkdown components={markdownComponents}>{data.content}</ReactMarkdown>
      </div>
    );
  }

  return <pre className="mx-auto max-w-3xl whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">{data.content}</pre>;
}

function HtmlBody({ nodeId }: { nodeId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["node-content", nodeId],
    queryFn: () => getNodeContent(nodeId),
  });

  if (isLoading) return <p className="px-6 py-6 text-sm text-muted-foreground">Loading…</p>;
  if (error) return <p className="px-6 py-6 text-sm text-red-600">{error instanceof ApiError ? error.message : "Couldn't load this file."}</p>;
  if (!data) return null;

  // Untrusted course-bundled HTML — sandbox="" blocks scripts, forms, popups, and
  // same-origin access so it can't touch the app's session even if it tries.
  return <iframe sandbox="" srcDoc={data.content} title="Notes" className="h-full w-full border-0 bg-white" />;
}

export function FilePreviewPane({ node, onClose }: { node: CourseTreeNode; onClose: () => void }) {
  const kind = getPreviewKind(node.rawName);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-3">
        <h1 className="truncate text-lg font-semibold text-foreground">{node.title}</h1>
        <div className="flex shrink-0 items-center gap-1">
          <a
            href={`/api/nodes/${node.id}/download`}
            title="Download"
            aria-label="Download file"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Download size={16} />
          </a>
          <button
            onClick={onClose}
            title="Close"
            aria-label="Close file preview"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {kind === "pdf" ? (
          <iframe src={`/api/nodes/${node.id}/inline`} title={node.title} className="h-full w-full border-0" />
        ) : kind === "html" ? (
          <HtmlBody nodeId={node.id} />
        ) : kind ? (
          <div className="px-6 py-6">
            <TextOrMarkdownBody nodeId={node.id} kind={kind} />
          </div>
        ) : (
          <p className="px-6 py-6 text-sm text-muted-foreground">This file type can't be previewed here.</p>
        )}
      </div>
    </div>
  );
}
