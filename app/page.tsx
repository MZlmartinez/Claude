import { getProfile } from "@/lib/getProfile";
import { Navbar } from "@/components/Navbar";
import { HomeCard } from "@/components/HomeCard";

export default async function Home() {
  const { profile } = await getProfile();

  return (
    <div className="flex flex-1 flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <section
          className="overflow-hidden rounded-2xl border border-white/10 bg-cover bg-center p-8"
          style={
            profile.cover_image_url
              ? { backgroundImage: `url(${profile.cover_image_url})` }
              : { background: "linear-gradient(135deg, #1a1a1f, #0a0a0c)" }
          }
        >
          <p className="text-sm text-white/60">Bienvenido/a</p>
          <h1 className="mt-1 text-3xl font-semibold text-white drop-shadow">
            {profile.full_name ?? "Cliente"}
          </h1>
          {profile.company && (
            <p className="mt-1 text-white/70 drop-shadow">{profile.company}</p>
          )}
        </section>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <HomeCard
            href="/dashboard"
            title="Dashboard"
            description="El estado de tus campañas y resultados en un solo lugar."
          />
          <HomeCard
            href="/archivos"
            title="Archivos"
            description="Los archivos que Moscu compartió con vos en Drive."
          />
          <HomeCard
            href="/agenda"
            title="Agenda"
            description="Reservá o revisá tus próximas reuniones con el equipo."
          />
          <HomeCard
            href="/insights"
            title="Insights"
            description="Métricas y aprendizajes clave de tu cuenta."
          />
        </div>
      </main>
    </div>
  );
}
