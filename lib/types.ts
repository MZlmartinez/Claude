export type Profile = {
  id: string;
  full_name: string | null;
  company: string | null;
  cover_image_url: string | null;
  dashboard_embed_url: string | null;
  drive_folder_url: string | null;
  agenda_embed_url: string | null;
  insights_embed_url: string | null;
  role: "client" | "admin";
};
