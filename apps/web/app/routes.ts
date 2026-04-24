import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("design", "routes/design.tsx"),
  route("help", "routes/help.tsx"),
  route("docs", "routes/docs.tsx"),
  route("login", "routes/login.tsx"),
  route("builder/:id", "routes/builder.$id.tsx"),
  route("tools/:toolId/runs/:runId", "routes/tools.$toolId.runs.$runId.tsx"),
  route("me/feed", "routes/me.feed.tsx"),
  route("search", "routes/search.tsx"),
  route("explore", "routes/explore.tsx"),
  route("waitlist", "routes/waitlist.tsx"),
  route("admin/evolutions", "routes/admin.evolutions.tsx"),
  route("agents/:agentId/evolutions", "routes/agents.$agentId.evolutions.tsx"),
  // Genealogy tree for a specific public agent. Must be registered BEFORE
  // the two-segment `:prefixedHandle/:slug` catch-all below.
  route(":prefixedHandle/:slug/genealogy", "routes/handle-agent.genealogy.tsx"),
  // Public agent profile. RR7's flat-routes typegen doesn't play well with
  // a literal `@` prefix on a dynamic segment, so we use a plain 2-segment
  // catch-all and enforce the `@` in the loader — URL still reads as
  // `/@jinhui/hn-summary`, which is what we care about.
  // Must come AFTER every literal-prefixed route above so `/builder/…` etc.
  // win the match.
  route(":prefixedHandle/:slug", "routes/handle-agent.tsx"),
] satisfies RouteConfig;
