CREATE TABLE "tokens_cuenta" (
	"id" serial PRIMARY KEY,
	"usuario_id" integer NOT NULL,
	"tipo" varchar(30) NOT NULL,
	"token_hash" varchar(64) NOT NULL UNIQUE,
	"nuevo_email" varchar(255),
	"expira_en" timestamp NOT NULL,
	"usado_en" timestamp,
	"creado_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tokens_cuenta" ADD CONSTRAINT "tokens_cuenta_usuario_id_usuarios_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE;