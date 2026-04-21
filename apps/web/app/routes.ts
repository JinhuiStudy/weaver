import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("design", "routes/design.tsx"),
  route("builder/:id", "routes/builder.$id.tsx"),
] satisfies RouteConfig;
