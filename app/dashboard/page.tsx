import { getProfile } from "@/lib/getProfile";
import { Navbar } from "@/components/Navbar";
import { EmbedFrame } from "@/components/EmbedFrame";

export default async function DashboardPage() {
  const { profile } = await getProfile();

  return (
    <div className="flex flex-1 flex-col">
      <Navbar profile={profile} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h1 className="mb-6 text-2xl">Dashboard</h1>
        <EmbedFrame
          url={profile.dashboard_embed_url}
          title="Dashboard"
          emptyMessage="Todavía no configuramos tu dashboard. Escribinos a Moscu para activarlo."
        />
      </main>
    </div>
  );
}
