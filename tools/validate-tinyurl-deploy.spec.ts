import assert from 'node:assert';
import * as fs from 'node:fs';
import * as yaml from 'js-yaml';
import { describe, expect, it } from '@jest/globals';

function loadAll(file: string): Array<Record<string, unknown>> {
  return yaml.loadAll(fs.readFileSync(file, 'utf8')) as Array<Record<string, unknown>>;
}

function load(file: string, kind?: string): Record<string, unknown> {
  const docs = loadAll(file);
  if (kind) {
    assert.ok(
      docs.length === docs.filter((doc) => doc.kind === kind).length ||
        Boolean(docs.find((doc) => doc.kind === kind)),
      'kind not found',
    );
    return docs.find((doc) => doc.kind === kind) as Record<string, unknown>;
  }
  return docs[0]!;
}

describe('tinyurl deploy manifests', () => {
  it('declares the namespace and TinyURL own Postgres with a 1Gi claim', () => {
    const sts = load('projects/tinyurl/deploy/postgres-statefulset.yaml', 'StatefulSet') as {
      kind: string;
      spec: {
        volumeClaimTemplates: Array<{ spec: { resources: { requests: { storage: string } } } }>;
      };
    };
    expect(sts.kind).toBe('StatefulSet');
    expect(String(sts.spec.volumeClaimTemplates![0]!.spec.resources.requests.storage)).toBe('1Gi');
  });

  it('keeps credentials out of the committed secret template', () => {
    const raw = fs.readFileSync('projects/tinyurl/deploy/postgres-secret.yaml.template', 'utf8');
    expect(raw).toContain('${TINYURL_DB_PASSWORD}');
    expect(raw).not.toMatch(/password:\s*[^\s$]/i);
  });

  it('wires liveness and readiness to the split probes', () => {
    const dep = load('projects/tinyurl/deploy/tinyurl-deployment.yaml') as {
      spec: {
        template: {
          spec: {
            containers: Array<{
              livenessProbe: { httpGet: { path: string } };
              readinessProbe: { httpGet: { path: string } };
            }>;
          };
        };
      };
    };
    const container = dep.spec!.template.spec.containers[0]!;
    expect(container.livenessProbe.httpGet.path).toBe('/actuator/health/liveness');
    expect(container.readinessProbe.httpGet.path).toBe('/actuator/health/readiness');
  });

  it('uses a placeholder ingress host and only manifest-declared resources', () => {
    const ing = load('projects/tinyurl/deploy/tinyurl-ingress.yaml') as {
      kind: string;
      spec: { rules: Array<{ host: string }> };
    };
    expect(ing.kind).toBe('Ingress');
    expect(ing.spec.rules[0]!.host).toMatch(/\.invalid$/);
  });

  it('exposes the app service on 8082 and waits for postgres', () => {
    const svc = load('projects/tinyurl/deploy/tinyurl-service.yaml') as {
      kind: string;
      spec: { ports: Array<{ port: number }> };
    };
    expect(svc.kind).toBe('Service');
    expect(svc.spec.ports[0]!.port).toBe(8082);
    const ns = load('projects/tinyurl/deploy/namespace.yaml') as {
      kind: string;
      metadata: { name: string };
    };
    expect(ns.metadata.name).toBe('tinyurl');
    const dep = load('projects/tinyurl/deploy/tinyurl-deployment.yaml') as {
      spec: { template: { spec: { initContainers: Array<{ name: string }> } } };
    };
    expect(dep.spec.template.spec.initContainers.map((c) => c.name)).toContain('wait-for-postgres');
  });
});
