# AWS deployment preparation — not deployed

The task template runs the same verified API image and worker on ECS Fargate. Replace every REPLACE_WITH value before registering. No resources are provisioned by this repository. Creating resources requires the owner's explicit billing approval.

Required services and network:
- ECS API/worker in private subnets, HTTPS Application Load Balancer for the API, frontend served separately.
- RDS PostgreSQL 16: private endpoint, encryption, backups. DATABASE_URL must include `sslmode=verify-full` and a trusted RDS CA installed/configured in the image. Test this trust setup before deployment; it has not been cloud verified.
- ElastiCache Redis OSS 7: private endpoint, TLS (`rediss://`), authentication, `noeviction` for BullMQ, sufficient memory, queue durability/backups appropriate to the workload.
- Security groups: only ALB -> API 4100; API/worker -> RDS 5432 and Redis 6379. Neither database gets public ingress.
- ECR immutable image digest; Secrets Manager references supplied to the execution role with least-privilege access; CloudWatch logs with retention. The task role needs no S3 permission.

Apply `server/sql/schema.sql` via a controlled migration task after backup and staging verification. Existing databases need this migration; initialization mounts run only for empty databases. Redis keys expire after 60 seconds. Pending CSV lives in PostgreSQL and is cleared after completion/permanent validation failure; metadata remains to preserve idempotency. S3 adds no benefit at the current 2 MB file limit and is deliberately not implemented.

The template is configuration preparation, not evidence of AWS deployment experience. Independently scaling workers, health/readiness checks, retention cleanup, rate limiting, credentials rotation, and cloud failover/load testing remain production work.

References: [ECS secret injection](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/specifying-sensitive-data.html), [ElastiCache TLS](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/in-transit-encryption.html).
