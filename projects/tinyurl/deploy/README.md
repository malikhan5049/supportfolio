# TinyURL deploy manifests

Namespace-scoped k3s manifests for TinyURL with its **own** PostgreSQL (StatefulSet + 1Gi PVC).

## What is here versus what runs

These manifests are **committed and reviewed only — they are not deployed** by this plan: no real
cluster, no DNS, no TLS, no CD execution. The only k3s that runs is the disposable one inside
`tinyurl-k3s-manifests` in CI (amd64, locally built image, dummy secrets). The successor
cluster/VM plan supplies the domain, TLS, and flips CD on.

## Files

- `namespace.yaml` — namespace `tinyurl`.
- `postgres-statefulset.yaml` — TinyURL's own Postgres (replica 1, 1Gi PVC, `pg_isready` probe) + headless Service.
- `postgres-secret.yaml.template` — secret rendered via `envsubst` from `TINYURL_DB_NAME`, `TINYURL_DB_USER`, `TINYURL_DB_PASSWORD`.
  No credential is committed; CI substitutes dummy values.
- `tinyurl-deployment.yaml` — app Deployment (`${TINYURL_IMAGE}` placeholder, `IfNotPresent`, initContainer waits for Postgres, split liveness/readiness probes).
- `tinyurl-service.yaml` — Service on port 8082.
- `tinyurl-ingress.yaml` — placeholder host `tinyurl.example.invalid` (the successor plan supplies the real host + TLS).

## Rendering locally

```bash
export TINYURL_IMAGE=ghcr.io/OWNER/tinyurl:sha-XYZ
export TINYURL_DB_NAME=tinyurl TINYURL_DB_USER=tinyurl TINYURL_DB_PASSWORD=change-me
export TINYURL_IDENTITY_URI=http://identity:8080 TINYURL_IDENTITY_JWK_SET_URI=http://identity:8080/oauth2/jwks TINYURL_IDENTITY_ISSUER_URI=http://identity:8080
envsubst < projects/tinyurl/deploy/postgres-secret.yaml.template > /tmp/secret.yaml
envsubst < projects/tinyurl/deploy/tinyurl-deployment.yaml > /tmp/deploy.yaml
kubectl apply -f /tmp/secret.yaml && kubectl apply -f /tmp/deploy.yaml
```
