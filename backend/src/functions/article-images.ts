import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { requireUser } from "../lib/session.js";

// Imágenes subidas desde el editor de artículos (portada o imágenes dentro del texto)
//   POST /api/article-images  (JWT, cuerpo = imagen) -> { url }  [protegida]
//   GET  /api/article-images/:key                            -> la imagen

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

const store = () => getStore("article-images");

export default async (req: Request, context: Context) => {
  if (req.method === "GET") {
    const key = context.params.key;
    if (!key || !/^[\w.-]+$/.test(key)) return new Response("Not found", { status: 404 });
    const result = await store().getWithMetadata(key, { type: "arrayBuffer" });
    if (!result) return new Response("Not found", { status: 404 });
    return new Response(result.data, {
      headers: {
        "Content-Type": String(result.metadata?.contentType || "application/octet-stream"),
        // Cada imagen tiene una clave única que nunca cambia
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  if (req.method === "POST") {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const usuarioId = auth.userId;
    try {

      const contentType = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      const ext = TYPES[contentType];
      if (!ext) return Response.json({ error: "Formato no válido. Usa JPG, PNG, WEBP, GIF o AVIF." }, { status: 400 });

      const data = await req.arrayBuffer();
      if (data.byteLength === 0) return Response.json({ error: "La imagen está vacía" }, { status: 400 });
      if (data.byteLength > MAX_BYTES) {
        return Response.json({ error: "La imagen es demasiado grande (máximo 5 MB)" }, { status: 413 });
      }

      const key = `u${usuarioId}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      await store().set(key, data, { metadata: { contentType, usuarioId } });
      return Response.json({ url: `/api/article-images/${key}` }, { status: 201 });
    } catch (err) {
      console.error(err);
      return Response.json({ error: "Error al subir la imagen" }, { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: ["/api/article-images", "/api/article-images/:key"] };
