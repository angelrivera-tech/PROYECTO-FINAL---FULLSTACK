import { articulos } from "../db/schema.js";

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

// Primera imagen (src) dentro del HTML del artículo, o null si no hay ninguna
export function firstImageSrc(html: unknown): string | null {
  if (typeof html !== "string") return null;
  const match = html.match(/<img\b[^>]*?\ssrc\s*=\s*(["'])(.*?)\1/i);
  const src = match ? match[2].trim() : "";
  return src || null;
}

// Imagen que se mostrará con el artículo: la portada elegida o, si no hay, la primera del contenido
export function resolveArticleImage(imageUrl: unknown, content: unknown): string | null {
  const cover = typeof imageUrl === "string" ? imageUrl.trim() : "";
  return cover || firstImageSrc(content);
}
