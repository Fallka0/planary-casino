export const AUTH_BASE_URL = process.env.NEXT_PUBLIC_AUTH_BASE_URL || "https://auth.planary.ch";

/** auto=1: someone already signed in at planary-auth comes straight back without a click. */
export function buildAuthUrl(mode: "login" | "signup", returnTo: string) {
  const target = new URL(mode === "signup" ? "/signup" : "/", AUTH_BASE_URL);
  target.searchParams.set("returnTo", returnTo);
  if (mode === "login") target.searchParams.set("auto", "1");
  return target.toString();
}
