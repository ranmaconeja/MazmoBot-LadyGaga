# LadyGaga v1.3 — Bot de moderación para Mazmo

Bot para Mazmo orientado a la moderación y entretenimiento del canal de Femdom Argentina.
Construido sobre NestJS + TypeScript. Corre como funciones serverless en **Vercel**, con
persistencia en **Turso** (SQLite alojado) para el sistema de puntos y la cola del
reproductor.

## Alcance de la v1.3

Bot estable y modular: moderación, sistema de puntos anti-spam, compatibilidad vía IA
(seria y astral/satírica), detección de links de YouTube, autofrases, búsqueda de roles
sin IA, y cola de reproducción para un cliente de Windows aparte. **Sin** LadyPanel,
rifas ni playlist con historial.

## Comandos

- `!ayuda` — Lista los comandos disponibles
- `!ping` — Verifica que el bot esté activo
- `!version` — Muestra la versión del bot
- `!staff` — Lista de moderadores del canal
- `!creador` — Información del creador del bot
- `!perfil` / `!perfil @usuario` — Muestra tu perfil de Mazmo o el de otro usuario indicado
- `!bienvenida` — Vuelve a mostrar el mensaje de bienvenida
- `!reglas` — Muestra las reglas del canal
- `!filosofia` — Muestra el texto de "filosofía" del canal
- `!puntos` / `!puntos @usuario` — Consulta tu saldo de puntos o el de otro usuario (ver sección "Sistema de puntos" abajo)
- `!sumarpuntos @usuario <cantidad>` — (solo moderadores/owner) suma puntos a un usuario
- `!compatibilidad @usuario1 @usuario2` — La IA calcula un % de compatibilidad "real" entre dos perfiles según sus etiquetas
- `!compatibilidadastral @usuario1 @usuario2` — Versión satírica, basada en el signo zodiacal por fecha de registro
- `M!p <link de YouTube>` — Encola la canción para el cliente de reproducción (ver sección abajo)

## Configuración

Toda la configuración vive en `/config`, **no hay nada hardcodeado**:

- `config.json` — `BOT_NAME`, `CHANNEL_NAME`, `OWNER`, `VERSION`.
- `mensajes.txt` — Todos los textos visibles del bot, por bloques `[NOMBRE]`, con variables
  tipo `{BOT_NAME}`, `{CHANNEL_NAME}`, `{OWNER}`, `{VERSION}`, `{MODERATORS}`, etc.
- `moderadores.txt` — Un ID de usuario de Mazmo por línea (`#` para comentarios).
- `autofrases.txt` — Respuestas automáticas por palabra clave (ver sección abajo).
- `busquedas.txt` — Reglas de detección de "búsquedas" tipo "busco Dominante" (sin IA).
- `tags.json` — Diccionario de traducción de tags de Mazmo al español.

Además, en `.env` (versionado en el repo porque es privado y de uso personal):

```
BOT_SECRET=<bot secret provisto por mazmo, valida los webhooks entrantes>
OWNER_ID=<tu id de usuario, siempre tratado como moderador>
TURSO_DATABASE_URL=<url de tu base en Turso>
TURSO_AUTH_TOKEN=<token de autenticación de Turso>
GEMINI_API_KEY=<opcional, para !compatibilidad y !compatibilidadastral>
GROQ_API_KEY=<opcional, respaldo/carrera con Gemini>
YOUTUBE_API_KEY=<opcional, sin ella la info de YouTube funciona pero sin descripción>
PLAYER_SECRET_KEY=<autentica al programa de Windows contra GET /player/next>
```

## Cliente de reproducción (`M!p`)

El comando `M!p <link>` no reproduce nada del lado del servidor — encola el link en Turso
(tabla `player_queue`), y un programa de escritorio para Windows aparte (fuera de este
repo) hace **polling** cada 10-15 segundos contra `GET /player/next` para preguntar si
hay una canción nueva. Cuando la encuentra, la reproduce con `mpv`.

No usa WebSocket ni ninguna conexión persistente — eso no es viable en funciones
serverless (Vercel no soporta procesos ni conexiones que sobrevivan entre invocaciones),
así que se resolvió con este esquema de polling contra la base.

Configuración necesaria:
- `PLAYER_SECRET_KEY` en el `.env` del bot.
- El mismo valor tiene que estar configurado en el programa de Windows, que lo manda en
  el header `x-secret-key` de cada poll a `GET /player/next`.

El bot registra cada poll (`player_status`) para saber si hay algún cliente conectado en
ese momento. Si nadie pollea hace más de 60 segundos, `M!p` avisa "No hay ningún
reproductor conectado" en vez de encolar la canción en silencio.

## Compatibilidad con IA (`!compatibilidad` / `!compatibilidadastral`)

Le pasa las etiquetas y datos de dos usuarios a **Google Gemini y Groq al mismo tiempo**
(`AiRaceService`), y se queda con la que responda primero — así, si una de las dos se
queda sin cuota gratuita diaria, la otra cubre. Requiere `GEMINI_API_KEY` y/o
`GROQ_API_KEY` en el `.env` (con al menos una configurada alcanza). Sin ninguna de las
dos, el comando avisa que la IA no está disponible (no rompe el bot).

- `!compatibilidad` — análisis "serio": roles complementarios, afinidad de etiquetas,
  ubicación, qué tan activo es cada uno en la comunidad.
- `!compatibilidadastral` — versión satírica/cómica, basada en el "Signo Zodiacal
  Mazmorrero" de cada usuario (calculado con su fecha de **registro** en Mazmo, no su
  fecha de nacimiento real).

Uso: `!compatibilidad @usuario1 @usuario2` (también acepta IDs numéricos o usernames
como texto plano).

⚠️ Cosas a tener en cuenta:
- El criterio de "compatibilidad" que usa cada IA está en el prompt de
  `compatibility.service.ts` / `astral-compatibility.service.ts` — es una lógica
  razonable pero totalmente ajustable; si querés que priorice otra cosa, cambiá el prompt.
- Al ser modelos gratuitos, ocasionalmente pueden tardar unos segundos o fallar por cuota
  agotada — en ese caso el bot avisa en vez de trabarse (hay un timeout de 25s por las dudas).
- Estos análisis los genera una IA, no son un dato objetivo de Mazmo — conviene aclararlo
  en el canal para que se entienda como algo lúdico, no una verdad absoluta.

## Detección de links de YouTube

Cuando alguien pega un link de YouTube (`youtube.com/watch?v=...`, `youtu.be/...` o
`youtube.com/shorts/...`), el bot responde automáticamente con el título, la descripción
y la miniatura del video, usando el bloque `[YOUTUBE_INFO]` de `mensajes.txt`.

Hay dos modos, según tengas o no `YOUTUBE_API_KEY` en el `.env`:

- **Sin key** (funciona de entrada, sin configurar nada): usa el endpoint público de
  YouTube (oEmbed), que trae título y miniatura, pero **no** trae la descripción del video.
- **Con key** (recomendado): usa la YouTube Data API v3, que sí trae la descripción
  completa (se recorta a 300 caracteres para no mandar mensajes gigantes — ajustable en
  `youtube.service.ts`). La key es gratuita: se saca en
  [Google Cloud Console](https://console.cloud.google.com/) habilitando "YouTube Data API v3"
  y generando una API key, que después pegás en `YOUTUBE_API_KEY` del `.env`.

⚠️ **Sobre la miniatura:** la mando como imagen en markdown (`![miniatura](url)`) dentro
del mensaje, asumiendo que el chat de Mazmo renderiza imágenes embebidas en markdown (así
lo indica la documentación de Botleirplate sobre `rawContent`). Probalo una vez desplegado:
si el chat no soporta imágenes embebidas, vas a ver la URL como texto plano en vez de la
miniatura — avisame y lo resuelvo de otra forma (por ejemplo enviándola como link aparte).

## Autofrases (respuestas automáticas por palabra clave)

Cuando alguien escribe un mensaje que contiene alguna de las palabras clave configuradas
(por ejemplo "busco dom"), el bot responde automáticamente en el canal, sin que nadie
tenga que escribir un comando. Se configura en `config/autofrases.txt` con el formato:

```
palabra_clave_1|palabra_clave_2 = respuesta del bot
```

- No importan mayúsculas/minúsculas.
- Podés poner varias palabras clave separadas por `|` para que disparen la misma respuesta.
- Se usa la primera línea que coincida con el mensaje.
- Se recarga solo al reiniciar el bot (si editás el archivo, hay que reiniciar el proceso).

## Sistema de puntos (anti-spam)

Cada usuario arranca con 20 puntos, que se renuevan automáticamente a 20 (sin acumular)
cada 24hs. Ejecutar la mayoría de los comandos cuesta 5 puntos; si no tiene suficientes,
el comando no se ejecuta y se le avisa por privado. Moderadores y el owner del bot están
exentos: para ellos todos los comandos son siempre gratis. `!puntos`, `!ayuda`,
`!sumarpuntos` y `!compatibilidadtest` son gratis para todo el mundo (los últimos dos ya
tienen su propio chequeo de permisos adentro). Se persiste en Turso (`PointsRepository`),
no en memoria — necesario porque las funciones serverless no mantienen estado entre
invocaciones.

## Arquitectura

```
api/index.ts        → entry point real en Vercel (funciones serverless, cachea la app de Nest)
src/main.ts          → entry point tradicional (app.listen()), para desarrollo local
config/              → config.json, mensajes.txt, moderadores.txt, autofrases.txt, busquedas.txt, tags.json
src/
  commands/          → un archivo por comando (!ayuda, !ping, !sumarpuntos, M!p, etc.)
  modules/
    welcome/         → mensaje de bienvenida
    autofrases/      → respuestas automáticas por palabra clave
    busqueda/        → detección de "búsquedas" tipo "busco Dominante", sin IA
    youtube/         → info de videos de YouTube (Data API v3 u oEmbed)
    ai/              → Gemini + Groq en carrera, compatibilidad "seria" y astral
    player/          → cola de reproducción persistida en Turso
  database/
    database.service.ts   → conexión a Turso (SQLite alojado) y creación de tablas
    points.repository.ts  → persistencia del sistema de puntos
  services/
    bot.service.ts        → llamadas a la API de Mazmo
    command.service.ts    → ruteo de comandos y cobro de puntos
    config.service.ts     → carga config.json
    messages.service.ts   → carga mensajes.txt y reemplaza variables
    moderators.service.ts → carga moderadores.txt
    points.service.ts     → reglas del sistema de puntos (costo, exenciones)
    tags.service.ts       → traducción de tags de Mazmo al español
  middleware/         → verificación de bot-secret (BotRequestMiddleware)
  player.controller.ts → endpoint GET /player/next, poleado por el cliente de Windows
assets/               → recursos estáticos (imágenes, etc.)
```

Sin estado en memoria entre requests: todo lo que necesite sobrevivir entre invocaciones
(puntos, cola de reproducción) vive en Turso, nunca en variables del proceso.

## Instalación

```bash
npm install
```

## Correr localmente

```bash
npm run start:dev
```

Esto usa `src/main.ts` (hosting tradicional, con `app.listen()`), útil para desarrollo
local. En producción (Vercel) se usa `api/index.ts` en su lugar — ver sección de deploy.

Usá [ngrok](https://ngrok.com/) para exponer tu puerto local y configurar los webhooks
de tu bot en Mazmo apuntando a esa URL.

## Deploy en Vercel

El proyecto está pensado para desplegarse en Vercel como funciones serverless
(`vercel.json` enruta todo el tráfico a `api/index.ts`). Pasos:

1. Importá el repo en Vercel (o corré `vercel` desde la CLI).
2. Configurá las variables de entorno en el panel de Vercel (Project Settings →
   Environment Variables): `BOT_SECRET`, `OWNER_ID`, `TURSO_DATABASE_URL`,
   `TURSO_AUTH_TOKEN`, y opcionalmente `GEMINI_API_KEY`, `GROQ_API_KEY`,
   `YOUTUBE_API_KEY`, `PLAYER_SECRET_KEY`.
3. Completá `config/config.json` con los datos reales de tu bot antes de desplegar
   (se lee del filesystem de solo lectura en cada arranque de contenedor).
4. Asegurate de tener una base creada en [Turso](https://turso.tech/) — las tablas se
   crean solas la primera vez que arranca la función (`DatabaseService.onModuleInit`).

`main.ts` y el `Procfile` (`web: npm run start:prod`) quedan como alternativa para un
hosting tradicional no-serverless (Render, Heroku, un VPS, etc.), por si en algún
momento se necesita un proceso siempre activo — hoy no se usan en producción.

## Fuera de la v1.3

LadyPanel, API propia, playlist con historial, rifas, estadísticas avanzadas.

---

### Referencia: endpoints heredados de Botleirplate

- `/message` — mensajes de la sala (dispara comandos)
- `/sades_received` — transferencia de sades entrante
- `/user_enter` — ingreso de usuario (dispara bienvenida)
- `/user_leave` — salida de usuario
- `/new_ban` — notificación de baneo
- `/channel_updated` — actualización de canal
- `/message_updated`, `/reaction_added`, `/reaction_removed` — no disparados actualmente por Mazmo

### Cómo agregar un nuevo comando

1. Creá un archivo en `src/commands/` que implemente `CommandHandler` (mirá `ping.ts` de ejemplo).
2. Definí la cadena disparadora (con `!`) en `getSignature()`.
3. Agregalo a los `providers` de `app.module.ts`.
4. Inyectalo en el constructor de `CommandService` y llamá a `this.registerHandler(...)`.
