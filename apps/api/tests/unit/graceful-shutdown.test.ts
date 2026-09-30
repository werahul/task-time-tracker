import { createServer, request as httpRequest, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { lifecycle } from "../../src/lib/lifecycle";
import { createGracefulShutdown } from "../../src/lib/shutdown";

function get(port: number): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ port, path: "/", agent: false }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

let server: Server;
afterEach(() => {
  vi.restoreAllMocks();
  server?.close();
});

describe("graceful shutdown", () => {
  it("drains in-flight requests, refuses new ones, then disconnects and exits 0", async () => {
    // Pretend we're not already shutting down (module state is process-wide).
    let shuttingDown = false;
    vi.spyOn(lifecycle, "isShuttingDown").mockImplementation(() => shuttingDown);
    vi.spyOn(lifecycle, "beginShutdown").mockImplementation(() => {
      shuttingDown = true;
    });

    const order: string[] = [];
    server = createServer((_req, res) => {
      setTimeout(() => {
        order.push("request finished");
        res.end("done");
      }, 300);
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    let inFlight!: Promise<{ status: number; body: string }>;
    const exited = new Promise<number>((resolve) => {
      const shutdown = createGracefulShutdown({
        server,
        timeoutMs: 5000,
        disconnect: async () => {
          order.push("disconnected");
        },
        exit: (code) => {
          order.push("exited");
          resolve(code);
        },
      });

      inFlight = get(port);
      setTimeout(() => {
        shutdown("SIGTERM");
        order.push("shutdown requested");
        // New connections are refused once close() has been called.
        get(port).then(
          () => order.push("new request served (unexpected)"),
          () => order.push("new request refused"),
        );
      }, 50);
    });

    expect(await exited).toBe(0);
    expect(shuttingDown).toBe(true);
    // The request that was in flight when shutdown began still got its full response.
    expect(await inFlight).toEqual({ status: 200, body: "done" });
    // Server-side order: refuse new work, finish old work, then release dependencies.
    expect(order).toEqual([
      "shutdown requested",
      "new request refused",
      "request finished",
      "disconnected",
      "exited",
    ]);
  });

  it("forces exit(1) when draining exceeds the timeout", async () => {
    let shuttingDown = false;
    vi.spyOn(lifecycle, "isShuttingDown").mockImplementation(() => shuttingDown);
    vi.spyOn(lifecycle, "beginShutdown").mockImplementation(() => {
      shuttingDown = true;
    });

    server = createServer(() => {
      /* never responds */
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    get(port).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 50));

    const code = await new Promise<number>((resolve) => {
      createGracefulShutdown({
        server,
        timeoutMs: 200,
        disconnect: async () => {},
        exit: resolve,
      })("SIGTERM");
    });

    expect(code).toBe(1);
    server.closeAllConnections();
  });
});
