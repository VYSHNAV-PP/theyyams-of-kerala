import { createStart, createCsrfMiddleware } from "@tanstack/react-start";

// Blocks cross-site calls to server functions (the app currently has none, but new ones stay protected).
const csrfMiddleware = createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" });

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
}));
