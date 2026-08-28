import "@fontsource-variable/fraunces";
import type { CourseCertificate } from "@lecturn/shared";
import { toPng } from "html-to-image";
import { Download } from "lucide-react";
import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Logo } from "../Logo";

const SERIF = "'Fraunces Variable', ui-serif, serif";

export function GeneratedCertificate({ certificate }: { certificate: CourseCertificate }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const verifyUrl = `${window.location.origin}/verify/${certificate.code}`;
  const completedDate = new Date(certificate.completedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  async function handleDownload() {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 });
      const link = document.createElement("a");
      const slug = certificate.courseTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      link.download = `${slug || "certificate"}-certificate.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        ref={cardRef}
        className="certificate-card relative w-full max-w-2xl overflow-hidden rounded-lg border border-[#c9a227]/40 bg-[#faf6ec] px-8 py-12 text-center shadow-lg sm:px-14"
      >
        <div className="pointer-events-none absolute inset-3 rounded-md border border-[#c9a227]/50" />
        <div className="pointer-events-none absolute inset-4 rounded-md border border-[#1c2130]/10" />

        <Logo className="mx-auto mb-6 size-8 text-[#1c2130]" />
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#c96b3a]">Certificate of Completion</p>

        <p className="mt-8 text-sm text-[#6b6355]">This certifies that</p>
        <p className="mt-3 text-3xl font-medium text-[#1c2130]" style={{ fontFamily: SERIF }}>
          {certificate.recipientName}
        </p>

        <p className="mt-6 text-sm text-[#6b6355]">has successfully completed</p>
        <p className="mt-2 px-2 text-xl font-medium text-[#1c2130]" style={{ fontFamily: SERIF }}>
          {certificate.courseTitle}
        </p>

        <p className="mt-6 text-xs text-[#6b6355]">{completedDate}</p>

        <div className="mt-10 flex items-center justify-center gap-4 border-t border-[#1c2130]/10 pt-6">
          <QRCodeSVG value={verifyUrl} size={56} bgColor="transparent" fgColor="#1c2130" />
          <div className="text-left">
            <p className="text-[10px] uppercase tracking-wide text-[#8a8272]">Verification code</p>
            <p className="font-mono text-xs text-[#1c2130]">{certificate.code}</p>
            <p className="mt-0.5 text-[10px] text-[#8a8272]">Verify at {verifyUrl.replace(/^https?:\/\//, "")}</p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 print:hidden"
      >
        <Download size={16} />
        {downloading ? "Preparing…" : "Download as image"}
      </button>
    </div>
  );
}
