export const routePatterns = {
  shared: /^\/shared\/(?<shortCode>[^/]+)$/,
  project: /^\/project\/(?<projectId>[^/]+)$/,
  starterApp: /^\/apps\/(?<appId>[^/]+)$/,
} as const;
