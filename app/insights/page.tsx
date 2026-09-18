import { getProfile } from "@/lib/getProfile";
import { Navbar } from "@/components/Navbar";
import { EmbedFrame } from "@/components/EmbedFrame";

export default async function InsightsPage() {
  const { profile } = await getProfile();

  return (
    <div className="flex flex-1 flex-col">
      <Navbar profile={profile} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h1 className="mb-6 text-2xl">Insights</h1>
        <EmbedFrame
          url={profile.insights_embed_url}
          title="Insights"
          emptyMessage="Todavía no configuramos tus insights."
        />
      </main>
    </div>
  );
}
