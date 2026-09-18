export const AUTH_BASE_URL = process.env.NEXT_PUBLIC_AUTH_BASE_URL || "https://auth.planary.ch";
export const CASINO_URL = "https://casino.planary.ch";

/** auto=1: someone already signed in at planary-auth comes straight back without a click. */
export function buildAuthUrl(mode: "login" | "signup", returnTo: string, auto = mode === "login") {
  const target = new URL(mode === "signup" ? "/signup" : "/", AUTH_BASE_URL);
  target.searchParams.set("returnTo", returnTo);
  if (auto) target.searchParams.set("auto", "1");
  return target.toString();
}

/** Ends the Planary session too, otherwise single sign-on would sign people straight back in. */
export function signOutUrl(returnTo: string) {
  const target = new URL("/logout", AUTH_BASE_URL);
  target.searchParams.set("returnTo", returnTo);
  return target.toString();
}
