import { articulos } from "../../db/schema.js";

type Articulo = typeof articulos.$inferSelect;

// Devuelve el artículo con los mismos nombres de columna que usa el frontend
export function toArticleJson(a: Articulo) {
  return {
    id: a.id,
    title: a.title,
    category: a.category,
    image_url: a.imageUrl,
    content: a.content,
    usuario_id: a.usuarioId,
    fecha_publicacion: a.fechaPublicacion,
  };
}

export async function readJson(req: Request): Promise<Record<string, any>> {
  try {
    return (await req.json()) ?? {};
  } catch {
    return {};
  }
}
