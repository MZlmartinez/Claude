import Link from "next/link";

type HomeCardProps = {
  href: string;
  title: string;
  description: string;
};

export function HomeCard({ href, title, description }: HomeCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-[var(--accent)]/60 hover:bg-white/[0.06]"
    >
      <div>
        <span className="inline-block h-3 w-3 rounded-sm bg-[var(--accent)]" />
        <h3 className="font-heading mt-3 text-base text-white">{title}</h3>
        <p className="mt-2 text-sm text-white/60">{description}</p>
      </div>
      <span className="mt-6 text-sm text-[var(--accent)] opacity-0 transition group-hover:opacity-100">
        Ver más →
      </span>
    </Link>
  );
}
