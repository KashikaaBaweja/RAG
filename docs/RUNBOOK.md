# Operations runbook

## Deploy (AWS ECS example)

1. **Build and push the image**  
   From the repo root: `docker build -t $ECR_URL:latest .` then authenticate to ECR and `docker push $ECR_URL:latest`.

2. **Database migrations**  
   Run Prisma migrations against the target RDS instance before or in parallel with the new task revision (never after traffic has shifted if the schema is incompatible):  
   `DATABASE_URL=postgresql://… pnpm --filter web exec prisma migrate deploy`

3. **Register a new ECS task definition**  
   Point the container image tag at the revision you pushed. Bump CPU/memory only during a scheduled window if required.

4. **Roll the service**  
   Update the ECS service to the new task definition with **minimum healthy percent** 100 and **maximum percent** 200 for a rolling replace, or use a blue/green deployment if configured.

5. **Verify**  
   Hit the ALB DNS name, confirm `/api/metrics` returns `200`, run a smoke query from the dashboard, and watch CloudWatch logs for the `web` container.

## Rollback

1. In ECS, select the **previous task definition revision** that was known good.  
2. **Update service** to that revision and force a new deployment.  
3. If the database migrated forward incompatibly, restore RDS from the latest snapshot (last resort) and document the incident.

## On-call

1. **Page-worthy**: error rate on `/api/query` spikes, ALB target health all unhealthy, RDS CPU pegged with replication lag, Redis/ElastiCache evictions climbing with ingestion stalled.  
2. **First steps**: check ECS service events, recent task stops (`CannotPullContainerError`, OOM), ALB target group health, RDS `Performance Insights`, ElastiCache metrics, Langfuse (if enabled) for slow traces.  
3. **Mitigate**: scale desired task count up, temporarily disable destructive jobs, enable maintenance banner in the app if you have one.  
4. **Communicate**: post status + ETA in the team channel; after resolution, write a short incident note (cause, fix, follow-up).

## Environment highlights

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres for Prisma |
| `REDIS_URL` | BullMQ + per-user query budgets (`lib/security/rateLimit.ts`) |
| `RAG_USER_DAILY_TOKEN_BUDGET` | Estimated-token ceiling per user per UTC day |
| `RAG_USER_QUERIES_PER_MINUTE` | Burst cap per user |
| `RAG_RATE_LIMIT_STRICT` | Set to `1` to fail closed if Redis is missing (recommended in prod) |

## GCP note

For **Cloud Run + Cloud SQL + Memorystore**, mirror the same stages: build image to Artifact Registry, run migrations with Cloud SQL Auth Proxy or a Job, deploy a new revision with traffic migration, and use Memorystore as `REDIS_URL`.
