import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import type { Profile } from "@/lib/types";

const LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/archivos", label: "Archivos" },
  { href: "/agenda", label: "Agenda" },
  { href: "/insights", label: "Insights" },
];

type NavbarProps = {
  profile: Profile;
};

export function Navbar({ profile }: NavbarProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-[var(--background)]/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image src="/moscu-logo.png" alt="Moscu" width={307} height={77} className="h-6 w-auto" />
          <span className="font-heading text-sm text-[var(--accent)]">Portal</span>
        </Link>

        <div className="hidden items-center gap-6 text-sm text-white/70 md:flex">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-white">
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2.5 sm:flex">
            <Avatar name={profile.full_name} />
            <div className="text-right">
              <p className="text-sm leading-tight font-medium text-white">
                {profile.full_name ?? "Cliente"}
              </p>
              {profile.company && (
                <p className="text-xs leading-tight text-white/50">{profile.company}</p>
              )}
            </div>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full border border-white/15 px-4 py-1.5 text-sm text-white/70 transition hover:border-white/30 hover:text-white"
            >
              Salir
            </button>
          </form>
        </div>
      </nav>
    </header>
  );
}
