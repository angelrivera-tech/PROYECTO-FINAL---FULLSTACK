CREATE TABLE "articulos" (
	"id" serial PRIMARY KEY,
	"title" varchar(255) NOT NULL,
	"category" varchar(100) NOT NULL,
	"image_url" text,
	"content" text NOT NULL,
	"usuario_id" integer,
	"fecha_publicacion" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY,
	"username" varchar(100) NOT NULL UNIQUE,
	"password_hash" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL UNIQUE,
	"verification_code" varchar(10),
	"code_expires" timestamp
);
--> statement-breakpoint
ALTER TABLE "articulos" ADD CONSTRAINT "articulos_usuario_id_usuarios_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL;