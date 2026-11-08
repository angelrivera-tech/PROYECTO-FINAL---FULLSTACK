import type { Config, Context } from "@netlify/functions";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { articulos, usuarios } from "../../db/schema.js";
import { readJson, toArticleJson } from "../lib/shared.js";

export default async (req: Request, context: Context) => {
  const idParam = context.params.id;

  // Rutas con ID: /api/articles/:id
  if (idParam !== undefined) {
    const id = Number(idParam);
    if (!Number.isInteger(id)) {
      return Response.json({ error: "Artículo no encontrado" }, { status: 404 });
    }

    if (req.method === "GET") {
      try {
        const [article] = await db.select().from(articulos).where(eq(articulos.id, id));
        if (!article) return Response.json({ error: "Artículo no encontrado" }, { status: 404 });
        return Response.json(toArticleJson(article));
      } catch (err) {
        console.error(err);
        return Response.json({ error: "Error al obtener el artículo" }, { status: 500 });
      }
    }

    if (req.method === "PUT") {
      const { title, category, image_url, content, usuario_id } = await readJson(req);
      if (!title || !content) {
        return Response.json({ error: "El título y el contenido son obligatorios" }, { status: 400 });
      }

      try {
        const [existing] = await db.select().from(articulos).where(eq(articulos.id, id));
        if (!existing) return Response.json({ error: "Artículo no encontrado" }, { status: 404 });

        // Solo el autor del artículo puede editarlo
        const authorId = Number(usuario_id);
        if (existing.usuarioId === null || existing.usuarioId !== authorId) {
          return Response.json({ error: "Solo el autor puede editar este artículo" }, { status: 403 });
        }

        const [updated] = await db
          .update(articulos)
          .set({
            title,
            category: category || existing.category,
            imageUrl: image_url === undefined ? existing.imageUrl : image_url || null,
            content,
          })
          .where(eq(articulos.id, id))
          .returning();

        return Response.json({ message: "Artículo actualizado con éxito", article: toArticleJson(updated) });
      } catch (err) {
        console.error(err);
        return Response.json({ error: "Error al actualizar el artículo" }, { status: 500 });
      }
    }

    if (req.method === "DELETE") {
      try {
        // Solo el autor del artículo puede eliminarlo
        const authorId = Number(new URL(req.url).searchParams.get("usuario_id"));
        const [existing] = await db.select().from(articulos).where(eq(articulos.id, id));
        if (!existing) return Response.json({ error: "Artículo no encontrado" }, { status: 404 });
        if (!Number.isInteger(authorId) || existing.usuarioId === null || existing.usuarioId !== authorId) {
          return Response.json({ error: "Solo el autor puede eliminar este artículo" }, { status: 403 });
        }
        await db.delete(articulos).where(eq(articulos.id, id));
        return Response.json({ message: "Artículo eliminado con éxito" });
      } catch (err) {
        console.error(err);
        return Response.json({ error: "Error al eliminar el artículo" }, { status: 500 });
      }
    }

    return new Response("Method not allowed", { status: 405 });
  }

  // Rutas sin ID: /api/articles
  if (req.method === "GET") {
    try {
      // Filtro opcional por autor: /api/articles?usuario_id=5
      const authorParam = new URL(req.url).searchParams.get("usuario_id");
      if (authorParam !== null) {
        const authorId = Number(authorParam);
        if (!Number.isInteger(authorId)) return Response.json([]);
        const rows = await db
          .select()
          .from(articulos)
          .where(eq(articulos.usuarioId, authorId))
          .orderBy(desc(articulos.fechaPublicacion));
        return Response.json(rows.map(toArticleJson));
      }

      const rows = await db.select().from(articulos).orderBy(desc(articulos.fechaPublicacion));
      return Response.json(rows.map(toArticleJson));
    } catch (err) {
      console.error(err);
      return Response.json({ error: "Error al obtener los artículos" }, { status: 500 });
    }
  }

  if (req.method === "POST") {
    const { title, category, image_url, content, usuario_id } = await readJson(req);
    if (!title || !content) {
      return Response.json({ error: "El título y el contenido son obligatorios" }, { status: 400 });
    }

    try {
      // Solo enlazar el autor si el usuario existe realmente
      let usuarioId: number | null = null;
      const parsed = Number(usuario_id);
      if (Number.isInteger(parsed)) {
        const [author] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.id, parsed));
        usuarioId = author ? author.id : null;
      }

      const [created] = await db
        .insert(articulos)
        .values({
          title,
          category: category || "General",
          imageUrl: image_url || null,
          content,
          usuarioId,
        })
        .returning();

      return Response.json({ message: "Artículo creado con éxito", article: toArticleJson(created) }, { status: 201 });
    } catch (err) {
      console.error(err);
      return Response.json({ error: "Error al crear el artículo" }, { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: ["/api/articles", "/api/articles/:id"] };
