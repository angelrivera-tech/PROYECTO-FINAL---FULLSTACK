CREATE TABLE "articulos_guardados" (
	"id" serial PRIMARY KEY,
	"usuario_id" integer NOT NULL,
	"articulo_id" integer NOT NULL,
	"fecha_guardado" timestamp DEFAULT now(),
	CONSTRAINT "articulos_guardados_usuario_articulo_key" UNIQUE("usuario_id","articulo_id")
);
--> statement-breakpoint
ALTER TABLE "articulos_guardados" ADD CONSTRAINT "articulos_guardados_usuario_id_usuarios_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "articulos_guardados" ADD CONSTRAINT "articulos_guardados_articulo_id_articulos_id_fkey" FOREIGN KEY ("articulo_id") REFERENCES "articulos"("id") ON DELETE CASCADE;