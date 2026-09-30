import { Router } from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { buildOpenApiDocument } from "../docs/openapi";

const document = buildOpenApiDocument();

/** Mounted only when API_DOCS_ENABLED (default: on outside production). */
export const docsRouter = Router();

docsRouter.get("/openapi.json", (_req, res) => {
  res.json(document);
});

// Swagger UI needs its own scripts/styles, so it gets a relaxed CSP scoped to
// this route only; every other API response keeps `default-src 'none'`.
docsRouter.use(
  "/docs",
  helmet.contentSecurityPolicy({
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'none'"],
    },
  }),
  swaggerUi.serve,
  swaggerUi.setup(document, { customSiteTitle: "Task & Time Tracker API" }),
);
