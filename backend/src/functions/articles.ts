import type { Config, Context } from "@netlify/functions";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { articulos } from "../db/schema.js";
import { readJson, resolveArticleImage, toArticleJson } from "../lib/shared.js";
import { requireUser } from "../lib/session.js";

// GET es público. POST, PUT y DELETE son rutas protegidas: necesitan un JWT válido
// y el autor se toma del token, nunca de los datos que envía el navegador.

const NO_IMAGE_ERROR = "El artículo necesita una imagen para mostrarse. Añade una imagen de portada antes de publicar.";

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
      const auth = await requireUser(req);
      if (auth.error) return auth.error;
      const { title, category, image_url, content } = await readJson(req);
      if (!title || !content) {
        return Response.json({ error: "El título y el contenido son obligatorios" }, { status: 400 });
      }

      try {
        const [existing] = await db.select().from(articulos).where(eq(articulos.id, id));
        if (!existing) return Response.json({ error: "Artículo no encontrado" }, { status: 404 });

        // Solo el autor del artículo puede editarlo
        if (existing.usuarioId === null || existing.usuarioId !== auth.userId) {
          return Response.json({ error: "Solo el autor puede editar este artículo" }, { status: 403 });
        }

        // Un artículo publicado siempre debe tener una imagen que mostrar
        const imageUrl = resolveArticleImage(image_url === undefined ? existing.imageUrl : image_url, content);
        if (!imageUrl) return Response.json({ error: NO_IMAGE_ERROR }, { status: 400 });

        const [updated] = await db
          .update(articulos)
          .set({
            title,
            category: category || existing.category,
            imageUrl,
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
      const auth = await requireUser(req);
      if (auth.error) return auth.error;
      try {
        // Solo el autor del artículo puede eliminarlo
        const [existing] = await db.select().from(articulos).where(eq(articulos.id, id));
        if (!existing) return Response.json({ error: "Artículo no encontrado" }, { status: 404 });
        if (existing.usuarioId === null || existing.usuarioId !== auth.userId) {
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
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const { title, category, image_url, content } = await readJson(req);
    if (!title || !content) {
      return Response.json({ error: "El título y el contenido son obligatorios" }, { status: 400 });
    }

    // No se puede publicar un artículo sin una imagen que mostrar
    const imageUrl = resolveArticleImage(image_url, content);
    if (!imageUrl) return Response.json({ error: NO_IMAGE_ERROR }, { status: 400 });

    try {
      const [created] = await db
        .insert(articulos)
        .values({
          title,
          category: category || "General",
          imageUrl,
          content,
          usuarioId: auth.userId, // el autor es el usuario del JWT
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
