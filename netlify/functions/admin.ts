import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { and, count, desc, eq, ne } from "drizzle-orm";
import { db } from "../../db/index.js";
import { articulos, articulosGuardados, usuarios } from "../../db/schema.js";
import { readJson, resolveArticleImage, toArticleJson } from "../lib/shared.js";
import { isAdminUsername, requireAdmin } from "../lib/session.js";

// Panel de administración (solo para la cuenta de administrador)
//   GET    /api/admin/me                  -> confirma el acceso
//   GET    /api/admin/articles            -> todos los artículos con su autor
//   PUT    /api/admin/articles/:id        -> editar cualquier artículo
//   DELETE /api/admin/articles/:id        -> eliminar cualquier artículo
//   GET    /api/admin/users               -> todos los usuarios
//   PUT    /api/admin/users/:id           -> cambiar nombre de usuario / correo
//   DELETE /api/admin/users/:id?articles=delete|keep -> eliminar un usuario
//   GET    /api/admin/agents              -> agentes de IA (reservado para el futuro)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseId(value: string | undefined) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export default async (req: Request, context: Context) => {
  const auth = await requireAdmin(req).catch((err) => {
    console.error(err);
    return { error: Response.json({ error: "Error al verificar la sesión" }, { status: 500 }) };
  });
  if ("error" in auth) return auth.error;
  const admin = auth.user;

  const resource = context.params.resource;
  const id = context.params.id === undefined ? undefined : parseId(context.params.id);
  if (context.params.id !== undefined && !id) return Response.json({ error: "No encontrado" }, { status: 404 });

  try {
    if (resource === "me" && req.method === "GET") {
      return Response.json({ id: admin.id, username: admin.username, isAdmin: true });
    }

    // Espacio reservado para agentes de IA. Todavía no hay ninguno configurado.
    if (resource === "agents" && req.method === "GET") {
      return Response.json({ agents: [] });
    }

    if (resource === "articles") {
      if (id === undefined && req.method === "GET") {
        const rows = await db
          .select({ article: articulos, author: usuarios.username })
          .from(articulos)
          .leftJoin(usuarios, eq(articulos.usuarioId, usuarios.id))
          .orderBy(desc(articulos.fechaPublicacion));
        return Response.json(rows.map((r) => ({ ...toArticleJson(r.article), author: r.author })));
      }
      if (id === undefined) return new Response("Method not allowed", { status: 405 });

      const [existing] = await db.select().from(articulos).where(eq(articulos.id, id));
      if (!existing) return Response.json({ error: "Artículo no encontrado" }, { status: 404 });

      if (req.method === "PUT") {
        const { title, category, image_url, content } = await readJson(req);
        if (!String(title ?? "").trim() || !String(content ?? "").trim()) {
          return Response.json({ error: "El título y el contenido son obligatorios" }, { status: 400 });
        }
        const imageUrl = resolveArticleImage(image_url === undefined ? existing.imageUrl : image_url, content);
        if (!imageUrl) {
          return Response.json({ error: "El artículo necesita una imagen de portada o una imagen en el contenido." }, { status: 400 });
        }
        const [updated] = await db
          .update(articulos)
          .set({
            title: String(title).trim().slice(0, 255),
            category: String(category ?? "").trim().slice(0, 100) || existing.category,
            imageUrl,
            content: String(content),
          })
          .where(eq(articulos.id, id))
          .returning();
        return Response.json({ message: "Artículo actualizado", article: toArticleJson(updated) });
      }

      if (req.method === "DELETE") {
        await db.delete(articulos).where(eq(articulos.id, id));
        return Response.json({ message: "Artículo eliminado" });
      }
    }

    if (resource === "users") {
      if (id === undefined && req.method === "GET") {
        const [users, published, saved] = await Promise.all([
          db.select({ id: usuarios.id, username: usuarios.username, email: usuarios.email }).from(usuarios).orderBy(usuarios.id),
          db.select({ uid: articulos.usuarioId, n: count() }).from(articulos).groupBy(articulos.usuarioId),
          db.select({ uid: articulosGuardados.usuarioId, n: count() }).from(articulosGuardados).groupBy(articulosGuardados.usuarioId),
        ]);
        const pub = new Map(published.map((r) => [r.uid, Number(r.n)]));
        const sav = new Map(saved.map((r) => [r.uid, Number(r.n)]));
        return Response.json(
          users.map((u) => ({
            ...u,
            is_admin: isAdminUsername(u.username),
            published_count: pub.get(u.id) ?? 0,
            saved_count: sav.get(u.id) ?? 0,
          }))
        );
      }
      if (id === undefined) return new Response("Method not allowed", { status: 405 });

      const [existing] = await db.select({ id: usuarios.id, username: usuarios.username }).from(usuarios).where(eq(usuarios.id, id));
      if (!existing) return Response.json({ error: "Usuario no encontrado" }, { status: 404 });

      if (req.method === "PUT") {
        const body = await readJson(req);
        const username = String(body.username ?? "").trim();
        const email = String(body.email ?? "").trim().toLowerCase();
        if (!username || username.length > 100) {
          return Response.json({ error: "El nombre de usuario es obligatorio (máximo 100 caracteres)" }, { status: 400 });
        }
        if (!EMAIL_RE.test(email) || email.length > 255) {
          return Response.json({ error: "Escribe un correo electrónico válido" }, { status: 400 });
        }
        // El administrador no puede quitarse su propio acceso cambiando su nombre
        if (existing.id === admin.id && !isAdminUsername(username)) {
          return Response.json({ error: "No puedes cambiar el nombre de la cuenta de administrador." }, { status: 400 });
        }
        const [takenName] = await db.select({ id: usuarios.id }).from(usuarios).where(and(eq(usuarios.username, username), ne(usuarios.id, id)));
        if (takenName) return Response.json({ error: "Ese nombre de usuario ya está en uso" }, { status: 409 });
        const [takenEmail] = await db.select({ id: usuarios.id }).from(usuarios).where(and(eq(usuarios.email, email), ne(usuarios.id, id)));
        if (takenEmail) return Response.json({ error: "Ese correo ya está en uso" }, { status: 409 });

        const [updated] = await db
          .update(usuarios)
          .set({ username, email })
          .where(eq(usuarios.id, id))
          .returning({ id: usuarios.id, username: usuarios.username, email: usuarios.email });
        return Response.json({ message: "Usuario actualizado", user: updated });
      }

      if (req.method === "DELETE") {
        if (existing.id === admin.id) {
          return Response.json({ error: "No puedes eliminar tu propia cuenta de administrador desde aquí." }, { status: 400 });
        }
        const deleteArticles = new URL(req.url).searchParams.get("articles") === "delete";
        if (deleteArticles) {
          await db.delete(articulos).where(eq(articulos.usuarioId, id));
        } else {
          await db.update(articulos).set({ usuarioId: null }).where(eq(articulos.usuarioId, id));
        }
        await db.delete(usuarios).where(eq(usuarios.id, id));
        await getStore("avatars").delete(`user-${id}`).catch((err) => console.error(err));
        return Response.json({ message: "Usuario eliminado" });
      }
    }
  } catch (err: any) {
    console.error(err);
    return Response.json({ error: "Error en el panel de administración" }, { status: 500 });
  }

  return Response.json({ error: "No encontrado" }, { status: 404 });
};

export const config: Config = { path: ["/api/admin/:resource", "/api/admin/:resource/:id"] };
