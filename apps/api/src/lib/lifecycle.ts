/**
 * Process lifecycle state. Once shutdown begins, readiness reports 503 so a
 * load balancer stops routing new traffic here while in-flight requests finish.
 */
let shuttingDown = false;

export const lifecycle = {
  isShuttingDown: () => shuttingDown,
  beginShutdown: () => {
    shuttingDown = true;
  },
};
