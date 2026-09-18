"use client";

import { useAuth } from "./AuthProvider";

/** Shown in place of personal sections (chips, friends, rankings) to visitors who aren't signed in. */
export function SignInPrompt({ what }: { what: string }) {
  const { signIn } = useAuth();
  return (
    <div className="prompt">
      <p>{what}</p>
      <div className="prompt-actions">
        <button className="btn btn-cherry" onClick={() => signIn("login")}>
          Sign in
        </button>
        <button className="btn btn-quiet" onClick={() => signIn("signup")}>
          Create account
        </button>
      </div>
    </div>
  );
}
