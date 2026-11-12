import { getStore } from "@netlify/blobs";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { usuarios } from "../../db/schema.js";

// Cuentas con acceso al panel de administración (nombre de usuario exacto)
export const ADMIN_USERNAMES = ["Angel"];

export const isAdminUsername = (username: unknown) =>
  typeof username === "string" && ADMIN_USERNAMES.includes(username);

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
const SECRET_KEY = "session-secret";

let cachedSecret: string | null = null;

// Clave secreta para firmar las sesiones. Se genera una sola vez y se guarda en Netlify Blobs.
async function getSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;
  const store = getStore({ name: "app-config", consistency: "strong" });
  let secret: string | null = await store.get(SECRET_KEY, { type: "text" });
  if (!secret) {
    await store.set(SECRET_KEY, randomBytes(48).toString("hex"), { onlyIfNew: true });
    secret = await store.get(SECRET_KEY, { type: "text" });
  }
  if (!secret) throw new Error("No se pudo obtener la clave de sesión");
  cachedSecret = secret;
  return secret;
}

const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

// Crea un token de sesión firmado que se entrega al iniciar sesión con 2FA
export async function createSessionToken(userId: number): Promise<string> {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + SESSION_TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload, await getSecret())}`;
}

// Devuelve el ID del usuario si el token es válido y no ha expirado
export async function verifySessionToken(token: string | null | undefined): Promise<number | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload, await getSecret()));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!Number.isInteger(uid) || typeof exp !== "number" || exp < Date.now()) return null;
    return uid;
  } catch {
    return null;
  }
}

// Comprueba que la petición venga de un administrador con sesión válida
export async function requireAdmin(req: Request) {
  const header = req.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
  const userId = await verifySessionToken(token);
  if (!userId) {
    return { error: Response.json({ error: "Tu sesión no es válida o ha expirado. Inicia sesión de nuevo." }, { status: 401 }) };
  }
  const [user] = await db
    .select({ id: usuarios.id, username: usuarios.username })
    .from(usuarios)
    .where(eq(usuarios.id, userId));
  if (!user || !isAdminUsername(user.username)) {
    return { error: Response.json({ error: "No tienes permiso para usar el panel de administración." }, { status: 403 }) };
  }
  return { user };
}
