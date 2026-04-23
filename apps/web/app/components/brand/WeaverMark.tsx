export function WeaverMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 56 56" role="img" aria-label="Weaver logo">
      <title>Weaver</title>
      <path
        d="M8 20 C 20 20, 20 36, 32 36"
        stroke="var(--weaver-indigo)"
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M8 36 C 20 36, 20 20, 32 20"
        stroke="var(--weaver-cyan)"
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M32 20 C 44 20, 44 36, 48 36"
        stroke="var(--node-agent)"
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M32 36 C 44 36, 44 20, 48 20"
        stroke="var(--node-tool)"
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
