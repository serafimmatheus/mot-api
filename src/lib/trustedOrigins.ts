/**
 * Origens do frontend permitidas em CORS e no Better Auth.
 * Use BETTER_AUTH_TRUSTED_ORIGINS=comma,separated,full,urls para portas ou hosts extras
 * (ex.: http://localhost:3001,https://seu-app.vercel.app).
 */
export function trustedFrontendOrigins(): string[] {
  const single = process.env.BETTER_AUTH_TRUSTED_ORIGIN?.trim();
  const multiRaw = process.env.BETTER_AUTH_TRUSTED_ORIGINS?.trim();
  const fromMulti = multiRaw
    ? multiRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const list = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...(single ? [single] : []),
    ...fromMulti,
  ];
  return [...new Set(list)];
}
