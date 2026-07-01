import mermaid from "mermaid";
import { useEffect, useId, useState } from "react";
import { validateMermaidSource } from "../lib/mermaidSource";

mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });

type MermaidPreviewProps = {
  source: string;
};

export function MermaidPreview({ source }: MermaidPreviewProps) {
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const validationError = validateMermaidSource(source);

    if (validationError) {
      setSvg("");
      setError(validationError);
      return;
    }

    mermaid
      .render(`mermaid-${id}`, source)
      .then((result) => {
        if (!cancelled) {
          setSvg(result.svg);
          setError(null);
        }
      })
      .catch((renderError: unknown) => {
        if (!cancelled) {
          setSvg("");
          setError(String(renderError));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, source]);

  if (error) {
    return <div className="mermaid-preview-error">{error}</div>;
  }

  return (
    <div
      className="mermaid-preview"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
