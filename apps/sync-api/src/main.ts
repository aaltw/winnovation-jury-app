import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { SqliteStore } from "./sqlite-store";

const port = Number(process.env["PORT"] ?? 8787);
const app = createApp(new SqliteStore(process.env["DB_PATH"] ?? "jury.db"));
serve({ fetch: app.fetch, port });
console.log(`sync-api listening on :${port}`);
