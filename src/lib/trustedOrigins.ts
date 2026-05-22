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
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    /** Metro (Expo) no mesmo host que a API. */
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    /**
     * Expo no celular / emulador: `Origin` é `http://IP_LAN:8081` ou `http://10.x:8081`.
     * Padrões glob do Better Auth (dev local).
     */
    "http://192.168.*.*:8081",
    "http://10.*.*.*:8081",
    ...(single ? [single] : []),
    ...fromMulti,
  ];
  return [...new Set(list)];
}
