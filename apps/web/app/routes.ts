import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("design", "routes/design.tsx"),
  route("help", "routes/help.tsx"),
  route("login", "routes/login.tsx"),
  route("builder/:id", "routes/builder.$id.tsx"),
  route("tools/:toolId/runs/:runId", "routes/tools.$toolId.runs.$runId.tsx"),
  // Public agent profile. RR7's flat-routes typegen doesn't play well with
  // a literal `@` prefix on a dynamic segment, so we use a plain 2-segment
  // catch-all and enforce the `@` in the loader — URL still reads as
  // `/@jinhui/hn-summary`, which is what we care about.
  // Must come AFTER every literal-prefixed route above so `/builder/…` etc.
  // win the match.
  route(":prefixedHandle/:slug", "routes/handle-agent.tsx"),
] satisfies RouteConfig;
