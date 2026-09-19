import { avatarSrc, type PlayerBadge } from "@/lib/api";
import { initials } from "@/lib/games";

/**
 * A player's picture (or initials) inside their equipped border.
 * `status` adds the online/away dot.
 */
export function Avatar({
  player,
  size = 36,
  status,
  className = "",
}: {
  player: Pick<PlayerBadge, "name" | "avatar" | "border">;
  size?: number;
  status?: "online" | "away" | null;
  className?: string;
}) {
  const src = avatarSrc(player.avatar);
  return (
    <span
      className={`avatar${player.border ? ` ring ${player.border}` : ""}${status ? ` is-${status}` : ""} ${className}`.trim()}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.32) }}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" /> : initials(player.name)}
    </span>
  );
}
