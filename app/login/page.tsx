"use client";

import Image from "next/image";
import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, formAction, isPending] = useActionState(login, null);

  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2">
          <Image src="/moscu-logo.png" alt="Moscu" width={307} height={77} className="h-10 w-auto" />
          <span className="font-heading text-sm text-[var(--accent)]">Portal</span>
        </div>
        <p className="mt-4 text-center text-sm text-white/50">
          Ingresá con las credenciales que te dio Moscu.
        </p>

        <form action={formAction} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-white/70">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-white/70">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white transition disabled:opacity-60"
          >
            {isPending ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </main>
  );
}
