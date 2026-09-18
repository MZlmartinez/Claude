import { getProfile } from "@/lib/getProfile";
import {
  getPerformanceSnapshot,
  getRecentDocuments,
  getUpcomingMeetings,
} from "@/lib/getHomeData";
import { Navbar } from "@/components/Navbar";
import { HomeCard } from "@/components/HomeCard";
import { SidePanel } from "@/components/SidePanel";
import { MeetingRow } from "@/components/MeetingRow";
import { DocumentRow } from "@/components/DocumentRow";
import { PerformanceSnapshot } from "@/components/PerformanceSnapshot";

export default async function Home() {
  const { profile } = await getProfile();
  const [meetings, documents, snapshot] = await Promise.all([
    getUpcomingMeetings(profile.id),
    getRecentDocuments(profile.id),
    getPerformanceSnapshot(profile.id),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <Navbar profile={profile} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <section
            className="relative flex min-h-[320px] flex-col justify-center overflow-hidden rounded-2xl border border-white/10 bg-cover bg-center p-8"
            style={{
              backgroundImage: profile.cover_image_url
                ? `linear-gradient(90deg, rgba(10,10,10,.92) 0%, rgba(10,10,10,.55) 55%, rgba(10,10,10,.15) 100%), url(${profile.cover_image_url})`
                : "linear-gradient(135deg, #1f1f1f, #0e0e0e)",
            }}
          >
            <p className="font-heading text-xs tracking-[0.2em] text-[var(--accent)]">
              Tu portal · Tus datos · Tus resultados
            </p>
            <h1 className="mt-3 max-w-md text-3xl leading-tight text-white sm:text-4xl">
              Todo lo que necesitás, en un solo{" "}
              <span className="text-[var(--accent)]">lugar</span>.
            </h1>
            <p className="mt-3 max-w-md text-white/70">
              Bienvenido/a, {profile.full_name ?? "cliente"}
              {profile.company ? ` — ${profile.company}` : ""}.
            </p>
          </section>

          <div className="flex flex-col gap-4">
            <SidePanel
              title="Próximas reuniones"
              viewAllHref="/agenda"
              viewAllLabel="Ver agenda"
              isEmpty={meetings.length === 0}
              emptyMessage="No tenés reuniones agendadas."
            >
              {meetings.map((meeting) => (
                <MeetingRow key={meeting.id} meeting={meeting} />
              ))}
            </SidePanel>

            <SidePanel
              title="Últimos documentos"
              viewAllHref="/archivos"
              viewAllLabel="Ver todos"
              isEmpty={documents.length === 0}
              emptyMessage="Todavía no hay documentos destacados."
            >
              {documents.map((document) => (
                <DocumentRow key={document.id} document={document} />
              ))}
            </SidePanel>
          </div>
        </div>

        <PerformanceSnapshot
          periods={snapshot.periods}
          metricsByPeriod={snapshot.metricsByPeriod}
          insightByPeriod={snapshot.insightByPeriod}
        />

        <h2 className="font-heading mt-10 mb-4 text-sm text-[var(--accent)]">Acceso rápido</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
