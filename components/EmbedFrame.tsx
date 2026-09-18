type EmbedFrameProps = {
  url: string | null;
  title: string;
  emptyMessage: string;
};

export function EmbedFrame({ url, title, emptyMessage }: EmbedFrameProps) {
  if (!url) {
    return (
      <div className="flex h-[70vh] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-center text-white/50">
        <p className="max-w-sm px-6">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <iframe
      src={url}
      title={title}
      className="h-[70vh] w-full rounded-2xl border border-white/10 bg-white"
    />
  );
}
