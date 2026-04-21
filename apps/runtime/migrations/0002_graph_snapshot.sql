-- Week 4 — store a graph snapshot per run so Cron can resolve nodes/edges
-- without a separate tool_versions join. Lives on the run itself; when a
-- tool is updated mid-run, existing runs keep executing against the graph
-- they were started with.
ALTER TABLE agent_runs ADD COLUMN graph_json TEXT;
