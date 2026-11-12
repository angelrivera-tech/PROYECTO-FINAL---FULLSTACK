import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import bcrypt from "bcryptjs";
import { count, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { articulos, articulosGuardados, usuarios } from "../../db/schema.js";
import { maskEmail } from "../lib/mailer.js";
import { readJson } from "../lib/shared.js";

// Perfil del usuario y foto de perfil
//   GET    /api/profile?usuario_id=5                 -> datos del usuario
//   GET    /api/profile/avatar/5                     -> imagen de perfil
//   PUT    /api/profile/avatar?usuario_id=5  (image) -> subir / cambiar foto
//   DELETE /api/profile/avatar?usuario_id=5          -> quitar foto
//   DELETE /api/profile?usuario_id=5  { password }    -> eliminar la cuenta (los artículos publicados se conservan)

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const avatars = () => getStore("avatars");
const avatarKey = (id: number) => `user-${id}`;

function parseId(value: string | null | undefined) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function findUser(id: number) {
  const [user] = await db
    .select({ id: usuarios.id, username: usuarios.username, email: usuarios.email })
    .from(usuarios)
    .where(eq(usuarios.id, id));
  return user ?? null;
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const isAvatar = url.pathname.startsWith("/api/profile/avatar");

  // Servir la imagen de perfil
  if (isAvatar && req.method === "GET") {
    const id = parseId(context.params.id);
    if (!id) return new Response("Not found", { status: 404 });
    const result = await avatars().getWithMetadata(avatarKey(id), { type: "arrayBuffer" });
    if (!result) return new Response("Not found", { status: 404 });
    return new Response(result.data, {
      headers: {
        "Content-Type": String(result.metadata?.contentType || "image/png"),
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    });
  }

  const usuarioId = parseId(url.searchParams.get("usuario_id"));
  if (!usuarioId) {
    return Response.json({ error: "Debes iniciar sesión para ver tu perfil" }, { status: 401 });
  }

  try {
    const user = await findUser(usuarioId);
    if (!user) return Response.json({ error: "Usuario no encontrado" }, { status: 404 });

    if (!isAvatar && req.method === "GET") {
      const [[published], [saved], avatarMeta] = await Promise.all([
        db.select({ n: count() }).from(articulos).where(eq(articulos.usuarioId, usuarioId)),
        db.select({ n: count() }).from(articulosGuardados).where(eq(articulosGuardados.usuarioId, usuarioId)),
        avatars().getMetadata(avatarKey(usuarioId)),
      ]);
      const version = avatarMeta?.metadata?.updatedAt;
      // Los datos sensibles no se envían completos al navegador
      return Response.json({
        username: user.username,
        email_masked: maskEmail(user.email),
        published_count: Number(published?.n ?? 0),
        saved_count: Number(saved?.n ?? 0),
        avatar_url: avatarMeta ? `/api/profile/avatar/${usuarioId}?v=${encodeURIComponent(String(version ?? ""))}` : null,
      });
    }

    if (!isAvatar && req.method === "DELETE") {
      // Se pide la contraseña para confirmar que es el dueño de la cuenta
      const { password } = await readJson(req);
      if (!password) {
        return Response.json({ error: "Escribe tu contraseña para eliminar la cuenta" }, { status: 400 });
      }
      const [row] = await db
        .select({ passwordHash: usuarios.passwordHash })
        .from(usuarios)
        .where(eq(usuarios.id, usuarioId));
      if (!row || !(await bcrypt.compare(String(password), row.passwordHash))) {
        return Response.json({ error: "Contraseña incorrecta" }, { status: 403 });
      }

      // Los artículos publicados se conservan: solo se desvinculan del autor.
      // Los artículos guardados y los enlaces de la cuenta se borran en cascada.
      await db.update(articulos).set({ usuarioId: null }).where(eq(articulos.usuarioId, usuarioId));
      await db.delete(usuarios).where(eq(usuarios.id, usuarioId));
      await avatars().delete(avatarKey(usuarioId)).catch((err) => console.error(err));

      return Response.json({ message: "Cuenta eliminada" });
    }

    if (isAvatar && (req.method === "PUT" || req.method === "POST")) {
      const contentType = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!ALLOWED_TYPES.includes(contentType)) {
        return Response.json({ error: "Formato no válido. Usa JPG, PNG, WEBP o GIF." }, { status: 400 });
      }
      const data = await req.arrayBuffer();
      if (data.byteLength === 0) return Response.json({ error: "La imagen está vacía" }, { status: 400 });
      if (data.byteLength > MAX_AVATAR_BYTES) {
        return Response.json({ error: "La imagen es demasiado grande (máximo 2 MB)" }, { status: 413 });
      }
      const updatedAt = Date.now().toString();
      await avatars().set(avatarKey(usuarioId), data, { metadata: { contentType, updatedAt } });
      return Response.json({
        message: "Foto de perfil actualizada",
        avatar_url: `/api/profile/avatar/${usuarioId}?v=${updatedAt}`,
      });
    }

    if (isAvatar && req.method === "DELETE") {
      await avatars().delete(avatarKey(usuarioId));
      return Response.json({ message: "Foto de perfil eliminada", avatar_url: null });
    }
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Error al procesar el perfil" }, { status: 500 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: ["/api/profile", "/api/profile/avatar", "/api/profile/avatar/:id"],
};
