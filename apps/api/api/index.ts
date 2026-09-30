/**
 * Vercel serverless entry point: the whole Express app as one function.
 *
 * vercel.json rewrites every path to this function, and Express still sees the
 * original URL, so routes, middleware and the /api/v1 prefix are unchanged.
 * Long-running deployments (and local development) use src/server.ts instead,
 * which adds the HTTP server, timeouts and graceful shutdown.
 */
import { createApp } from "../src/app";

export default createApp();
