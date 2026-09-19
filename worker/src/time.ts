// The casino runs on Swiss time: the daily bonus resets at midnight and the leaderboard week starts Monday 00:00 in Zurich.

const ZONE = "Europe/Zurich";
const DAY = 24 * 60 * 60 * 1000;

function parts(ms: number) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  const y = Number(values.year);
  const m = Number(values.month);
  const d = Number(values.day);
  const wall = Date.UTC(y, m - 1, d, Number(values.hour), Number(values.minute), Number(values.second));
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(values.weekday);
  // Offset between Zurich wall-clock time and UTC at this instant.
  return { y, m, d, weekday, offset: wall - Math.floor(ms / 1000) * 1000 };
}

/** Zurich calendar day, YYYY-MM-DD. */
export function zurichDay(ms = Date.now()) {
  const { y, m, d } = parts(ms);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Epoch ms of the next Zurich midnight. */
export function nextZurichMidnight(ms = Date.now()) {
  const { y, m, d, offset } = parts(ms);
  return Date.UTC(y, m - 1, d) + DAY - offset;
}

/** Epoch ms of this week's Monday 00:00 in Zurich. */
export function zurichWeekStart(ms = Date.now()) {
  const { y, m, d, weekday, offset } = parts(ms);
  return Date.UTC(y, m - 1, d - weekday) - offset;
}

/** The Zurich calendar day before today, YYYY-MM-DD. */
export function zurichYesterday(ms = Date.now()) {
  const { y, m, d } = parts(ms);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/** Epoch ms of today's 00:00 in Zurich. */
export function zurichDayStart(ms = Date.now()) {
  const { y, m, d, offset } = parts(ms);
  return Date.UTC(y, m - 1, d) - offset;
}
