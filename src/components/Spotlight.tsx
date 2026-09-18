"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { formatChips, type Game, gameHost, gameUrl, STARTER_CHIPS } from "@/lib/games";
import { useAuth } from "./AuthProvider";
import { Poster, posterField, posterInk } from "./Poster";

const INTERVAL = 8000;

export function Spotlight({ games }: { games: Game[] }) {
  const { user, loading, signIn } = useAuth();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const game = games[index];

  const go = useCallback((step: number) => setIndex((i) => (i + step + games.length) % games.length), [games.length]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const autoplay = !paused && !reduced;
  useEffect(() => {
    if (!autoplay) return;
    const timer = window.setTimeout(() => go(1), INTERVAL);
    return () => window.clearTimeout(timer);
  }, [autoplay, index, go]);

  const isLive = game.status === "live";

  return (
    <section
      className="spotlight"
      aria-roledescription="carousel"
      aria-label="Featured games"
      style={{ "--field": posterField(game.id), "--ink": posterInk(game.id) } as React.CSSProperties}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {games.map((g, i) => (
        <div key={g.id} className="spotlight-art" data-active={i === index} aria-hidden="true">
          <Poster game={g.id} align="right" />
        </div>
      ))}

      <span className="pill spotlight-pill">{isLive ? "Open now" : index === 0 ? "Opens first" : "Coming soon"}</span>

      <div className="spotlight-copy" aria-live="polite">
        <h1 key={game.id} className="spotlight-title">
          {game.name}
        </h1>
        <p className="spotlight-blurb">{game.blurb}</p>
        <ul className="tags" aria-label="Tags">
          {game.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
          <li>{game.players}</li>
          <li>{gameHost(game)}</li>
        </ul>
        <div className="spotlight-cta">
          {isLive ? (
            <a className="btn btn-cherry btn-lg" href={gameUrl(game)}>
              Play {game.name}
            </a>
          ) : loading ? null : user ? (
            <span className="reserved">
              <Clock size={16} strokeWidth={2.2} aria-hidden="true" /> Opening soon
            </span>
          ) : (
            <button className="btn btn-cherry btn-lg" onClick={() => signIn("signup")}>
              Join and claim {formatChips(STARTER_CHIPS)} chips
            </button>
          )}
        </div>
      </div>

      <div className="spotlight-controls">
        <button className="round-btn" onClick={() => go(-1)} aria-label="Previous game">
          <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
        </button>
        <button className="round-btn" onClick={() => go(1)} aria-label="Next game">
          <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <div className="spotlight-count" aria-label={`Game ${index + 1} of ${games.length}`}>
        <span>
          {index + 1}/{games.length}
        </span>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <circle cx="12" cy="12" r="9" className="ring-track" />
          <circle
            key={`${index}-${autoplay}`}
            cx="12"
            cy="12"
            r="9"
            className={`ring-progress${autoplay ? " is-running" : ""}`}
            style={{ animationDuration: `${INTERVAL}ms` }}
          />
        </svg>
      </div>
    </section>
  );
}
