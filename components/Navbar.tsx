import Link from "next/link";
import { signOut } from "@/app/actions";

const LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/archivos", label: "Archivos" },
  { href: "/agenda", label: "Agenda" },
  { href: "/insights", label: "Insights" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-[var(--background)]/90 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Moscu <span className="text-[var(--accent)]">Portal</span>
        </Link>
        <div className="hidden items-center gap-6 text-sm text-white/70 sm:flex">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-white">
              {link.label}
            </Link>
          ))}
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-full border border-white/15 px-4 py-1.5 text-sm text-white/70 transition hover:border-white/30 hover:text-white"
          >
            Salir
          </button>
        </form>
      </nav>
    </header>
  );
}
