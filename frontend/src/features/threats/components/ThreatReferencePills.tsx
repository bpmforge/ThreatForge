"use client";

interface ThreatReferencePillsProps {
  cweIds?: string[];
  owaspIds?: string[];
}

export function ThreatReferencePills({
  cweIds,
  owaspIds,
}: ThreatReferencePillsProps) {
  if (!cweIds?.length && !owaspIds?.length) return null;

  return (
    <div className="px-3 pb-2 flex flex-wrap gap-1">
      {cweIds?.map((cwe) => (
        <a
          key={cwe}
          href={`https://cwe.mitre.org/data/definitions/${cwe.replace("CWE-", "")}.html`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-orange-100 text-orange-800 hover:bg-orange-200 transition-colors"
        >
          {cwe}
        </a>
      ))}
      {owaspIds?.map((owasp) => (
        <a
          key={owasp}
          href={`https://owasp.org/Top10/A${owasp.split(":")[0]?.replace("A", "")}_2021/`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-100 text-sky-800 hover:bg-sky-200 transition-colors"
        >
          OWASP {owasp}
        </a>
      ))}
    </div>
  );
}
