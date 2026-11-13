import { Hono } from "hono";
import { api } from "./api";
import type { AppEnv } from "./db";

const app = new Hono<{ Bindings: AppEnv }>();

app.route("/api", api);

app.get("/", (c) => c.text("RANTAI API"));

export default {
  async fetch(request: Request, env: AppEnv, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return app.fetch(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  },
};
