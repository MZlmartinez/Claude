import { formatDayMonth, formatTime } from "@/lib/format";
import type { Meeting } from "@/lib/types";

export function MeetingRow({ meeting }: { meeting: Meeting }) {
  const { day, month } = formatDayMonth(meeting.meeting_at);

  return (
    <div className="flex gap-3">
      <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-white/5 text-center">
        <span className="text-sm leading-none font-bold text-white">{day}</span>
        <span className="text-[10px] leading-none text-[var(--accent)]">{month}</span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">{meeting.title}</p>
        <p className="text-xs text-white/50">
          {formatTime(meeting.meeting_at)}
          {meeting.link ? (
            <>
              {" · "}
              <a href={meeting.link} className="text-[var(--accent)] hover:underline">
                Unirse
              </a>
            </>
          ) : (
            " · Sin enlace"
          )}
        </p>
      </div>
    </div>
  );
}
