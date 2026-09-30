import type { Server } from "node:http";
import { lifecycle } from "./lifecycle";
import { logger } from "./logger";

interface GracefulShutdownOptions {
  server: Server;
  /** Releases dependencies (e.g. prisma.$disconnect) after requests drain. */
  disconnect: () => Promise<void>;
  timeoutMs: number;
  exit: (code: number) => void;
}

/**
 * Builds the shutdown routine:
 *   1. fail readiness (load balancer stops routing here)
 *   2. stop accepting connections; close idle keep-alive sockets
 *   3. let in-flight requests finish
 *   4. disconnect dependencies, then exit
 * A timer forces exit(1) if draining exceeds `timeoutMs`. Idempotent.
 */
export function createGracefulShutdown({
  server,
  disconnect,
  timeoutMs,
  exit,
}: GracefulShutdownOptions) {
  return function shutdown(reason: string, exitCode = 0): void {
    if (lifecycle.isShuttingDown()) return;
    lifecycle.beginShutdown();
    logger.info({ event: "server.shutdown_started", reason }, "Shutting down");

    const forceExit = setTimeout(() => {
      logger.error(
        { event: "server.shutdown_forced", timeoutMs },
        "Shutdown timed out; forcing exit",
      );
      exit(1);
    }, timeoutMs);
    forceExit.unref();

    server.close(async (closeError) => {
      try {
        await disconnect();
        clearTimeout(forceExit);
        logger.info({ event: "server.shutdown_complete" }, "Shutdown complete");
        exit(closeError ? 1 : exitCode);
      } catch (err) {
        logger.error({ event: "server.shutdown_failed", err }, "Error during shutdown");
        exit(1);
      }
    });
    server.closeIdleConnections();
  };
}
