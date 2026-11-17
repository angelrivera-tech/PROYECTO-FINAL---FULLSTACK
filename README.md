# PROYECTO-FINAL---FULLSTACK

**Worldnews** — sitio de noticias full stack desplegado en Netlify.

## Estructura del Proyecto
```
proyecto-fullstack/
├── backend/
│   ├── src/
│   │   ├── functions/   API (Netlify Functions, rutas /api/*)
│   │   ├── lib/         código compartido (sesión, correo, utilidades)
│   │   └── db/          esquema y conexión a la base de datos (Drizzle)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/       páginas HTML
│   │   ├── css/         hojas de estilo
│   │   ├── js/          JavaScript del navegador
│   │   └── imagenes/    logos e imágenes
│   └── package.json
├── docs/
│   ├── arquitectura.md
│   └── manual_usuario.md
├── netlify/database/migrations/   migraciones de la base de datos (ubicación requerida por Netlify)
├── netlify.toml                   configuración de despliegue
├── drizzle.config.ts              configuración de Drizzle Kit
└── package.json                   dependencias del proyecto
```

## Desarrollo local
```bash
npm install
netlify dev
```

## Documentación
- [Arquitectura](docs/arquitectura.md)
- [Manual de usuario](docs/manual_usuario.md)
