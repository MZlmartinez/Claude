import { getProfile } from "@/lib/getProfile";
import { Navbar } from "@/components/Navbar";
import { EmbedFrame } from "@/components/EmbedFrame";
import { toDriveEmbedUrl } from "@/lib/driveEmbed";

export default async function ArchivosPage() {
  const { profile } = await getProfile();

  return (
    <div className="flex flex-1 flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold">Archivos</h1>
        <EmbedFrame
          url={
            profile.drive_folder_url
              ? toDriveEmbedUrl(profile.drive_folder_url)
              : null
          }
          title="Archivos compartidos"
          emptyMessage="Todavía no compartimos una carpeta de Drive con vos."
        />
      </main>
    </div>
  );
}
