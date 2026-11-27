import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { usuarios } from "../db/schema.js";

// Cuentas con acceso al panel de administración (nombre de usuario exacto)
export const ADMIN_USERNAMES = ["Angel"];

export const isAdminUsername = (username: unknown) =>
  typeof username === "string" && ADMIN_USERNAMES.includes(username);

const SESSION_TTL = "7d"; // duración de la sesión
const SECRET_KEY = "session-secret";
const ISSUER = "worldnews";

let cachedSecret: string | null = null;

// Clave secreta para firmar los JWT.
// Se usa la variable de entorno JWT_SECRET si existe; si no, se genera una sola vez y se guarda en Netlify Blobs.
async function getSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;
  if (process.env.JWT_SECRET) return (cachedSecret = process.env.JWT_SECRET);
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

// Crea un JWT (HS256) que se entrega al completar el inicio de sesión con 2FA.
// El "sub" (subject) del token es el ID del usuario.
export async function createSessionToken(userId: number): Promise<string> {
  return jwt.sign({}, await getSecret(), {
    algorithm: "HS256",
    subject: String(userId),
    issuer: ISSUER,
    expiresIn: SESSION_TTL,
  });
}

// Devuelve el ID del usuario si el JWT es válido y no ha expirado; si no, null
export async function verifySessionToken(token: string | null | undefined): Promise<number | null> {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, await getSecret(), { algorithms: ["HS256"], issuer: ISSUER });
    const uid = typeof payload === "object" ? Number(payload.sub) : NaN;
    return Number.isInteger(uid) && uid > 0 ? uid : null;
  } catch {
    return null; // firma incorrecta, token expirado o mal formado
  }
}

// Lee el token de la cabecera "Authorization: Bearer <token>"
export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() || null : null;
}

const sessionError = () =>
  Response.json({ error: "Tu sesión no es válida o ha expirado. Inicia sesión de nuevo." }, { status: 401 });

// Protección de rutas: exige un JWT válido de un usuario que todavía existe.
// Devuelve { userId } o { error } (una respuesta 401 lista para devolver).
export async function requireUser(req: Request): Promise<{ userId: number; error?: undefined } | { error: Response }> {
  const userId = await verifySessionToken(bearerToken(req));
  if (!userId) return { error: sessionError() };
  try {
    const [user] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.id, userId));
    if (!user) return { error: sessionError() };
    return { userId };
  } catch (err) {
    console.error(err);
    return { error: Response.json({ error: "Error al comprobar la sesión" }, { status: 500 }) };
  }
}

// Comprueba que la petición venga de un administrador con sesión válida
export async function requireAdmin(req: Request) {
  const userId = await verifySessionToken(bearerToken(req));
  if (!userId) return { error: sessionError() };
  const [user] = await db
    .select({ id: usuarios.id, username: usuarios.username })
    .from(usuarios)
    .where(eq(usuarios.id, userId));
  if (!user || !isAdminUsername(user.username)) {
    return { error: Response.json({ error: "No tienes permiso para usar el panel de administración." }, { status: 403 }) };
  }
  return { user };
}
