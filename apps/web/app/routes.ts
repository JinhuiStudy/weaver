import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("design", "routes/design.tsx"),
  route("builder/:id", "routes/builder.$id.tsx"),
  route("tools/:toolId/runs/:runId", "routes/tools.$toolId.runs.$runId.tsx"),
] satisfies RouteConfig;
