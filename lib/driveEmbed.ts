/**
 * Google Drive folder share links (drive.google.com/drive/folders/<id>) can't
 * be framed directly. This rewrites them to the embeddable folder-view URL
 * so the admin can paste a normal "share" link into the profile.
 */
export function toDriveEmbedUrl(url: string): string {
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (!match) return url;
  return `https://drive.google.com/embeddedfolderview?id=${match[1]}#list`;
}
