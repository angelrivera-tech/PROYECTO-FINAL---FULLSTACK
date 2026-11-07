import type { Config, Context } from "@netlify/functions";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { articulos, articulosGuardados, usuarios } from "../../db/schema.js";
import { readJson, toArticleJson } from "../lib/shared.js";

// Artículos guardados ("pin") para leer después
//   GET    /api/saved?usuario_id=5            -> artículos guardados del usuario
//   POST   /api/saved  { usuario_id, articulo_id } -> guardar
//   DELETE /api/saved/:articuloId?usuario_id=5 -> quitar
export default async (req: Request, context: Context) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const usuarioId = Number(url.searchParams.get("usuario_id"));
    if (!Number.isInteger(usuarioId) || usuarioId <= 0) return Response.json([]);

    try {
      const rows = await db
        .select({ article: articulos, savedAt: articulosGuardados.fechaGuardado })
        .from(articulosGuardados)
        .innerJoin(articulos, eq(articulosGuardados.articuloId, articulos.id))
        .where(eq(articulosGuardados.usuarioId, usuarioId))
        .orderBy(desc(articulosGuardados.fechaGuardado));

      return Response.json(rows.map((r) => ({ ...toArticleJson(r.article), fecha_guardado: r.savedAt })));
    } catch (err) {
      console.error(err);
      return Response.json({ error: "Error al obtener los artículos guardados" }, { status: 500 });
    }
  }

  if (req.method === "POST") {
    const body = await readJson(req);
    const usuarioId = Number(body.usuario_id);
    const articuloId = Number(body.articulo_id);
    if (!Number.isInteger(usuarioId) || !Number.isInteger(articuloId)) {
      return Response.json({ error: "Debes iniciar sesión para guardar artículos" }, { status: 400 });
    }

    try {
      const [user] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.id, usuarioId));
      if (!user) return Response.json({ error: "Usuario no encontrado" }, { status: 404 });
      const [article] = await db.select({ id: articulos.id }).from(articulos).where(eq(articulos.id, articuloId));
      if (!article) return Response.json({ error: "Artículo no encontrado" }, { status: 404 });

      await db
        .insert(articulosGuardados)
        .values({ usuarioId, articuloId })
        .onConflictDoNothing();

      return Response.json({ message: "Artículo guardado", saved: true }, { status: 201 });
    } catch (err) {
      console.error(err);
      return Response.json({ error: "Error al guardar el artículo" }, { status: 500 });
    }
  }

  if (req.method === "DELETE") {
    const usuarioId = Number(url.searchParams.get("usuario_id"));
    const articuloId = Number(context.params.id);
    if (!Number.isInteger(usuarioId) || !Number.isInteger(articuloId)) {
      return Response.json({ error: "Solicitud inválida" }, { status: 400 });
    }

    try {
      await db
        .delete(articulosGuardados)
        .where(and(eq(articulosGuardados.usuarioId, usuarioId), eq(articulosGuardados.articuloId, articuloId)));
      return Response.json({ message: "Artículo quitado de guardados", saved: false });
    } catch (err) {
      console.error(err);
      return Response.json({ error: "Error al quitar el artículo" }, { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: ["/api/saved", "/api/saved/:id"] };
