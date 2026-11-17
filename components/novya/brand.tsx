import Link from "next/link";

export function Brand({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link href={href} className="nv-brand" aria-label="NOVYA home">
      <span className="nv-brand-symbol">N</span>
      <span>NOVYA</span>
    </Link>
  );
}
