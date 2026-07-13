// Architecture dependency rules for the `app` service.
// Layers (by file path):
//   interface      : *.controller.ts, *.job.ts, app.ts, server.ts
//   application    : *.service.ts
//   infrastructure : *.repository.ts, *.client.ts, *.publisher.ts,
//                    shared/db, shared/messaging, shared/metrics
//   domain kernel  : shared/errors, shared/utils, *.types.ts, config
//
// app.ts / server.ts are the composition root and may import any layer, so
// they are excluded from the "from" side of the layering rules.

const INFRASTRUCTURE_FROM =
  '(^src/modules/.+\\.(repository|client|publisher)\\.ts$)|(^src/shared/(db|messaging|metrics)/)';
const INTERFACE_TO =
  '(^src/modules/.+\\.controller\\.ts$)|(^src/modules/.+\\.job\\.ts$)|(^src/app\\.ts$)|(^src/server\\.ts$)';
const DOMAIN_FROM =
  '(^src/shared/(errors|utils)/)|(^src/config/)|(^src/modules/.+\\.types\\.ts$)';

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies make the architecture hard to reason about.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'infrastructure-not-to-application',
      severity: 'error',
      comment: 'Infrastructure adapters must not depend on application services.',
      from: { path: INFRASTRUCTURE_FROM },
      to: { path: '^src/modules/.+\\.service\\.ts$' },
    },
    {
      name: 'infrastructure-not-to-interface',
      severity: 'error',
      comment: 'Infrastructure must not depend on the interface/delivery layer.',
      from: { path: INFRASTRUCTURE_FROM },
      to: { path: INTERFACE_TO },
    },
    {
      name: 'application-not-to-interface',
      severity: 'error',
      comment: 'Application services must not depend on the interface/delivery layer.',
      from: { path: '^src/modules/.+\\.service\\.ts$' },
      to: { path: INTERFACE_TO },
    },
    {
      name: 'domain-not-upward',
      severity: 'error',
      comment: 'Domain / shared kernel must not depend on higher layers.',
      from: { path: DOMAIN_FROM },
      to: {
        path:
          '(^src/modules/.+\\.(service|controller|repository|client|publisher|job)\\.ts$)' +
          '|(^src/shared/(db|messaging|metrics)/)|(^src/app\\.ts$)|(^src/server\\.ts$)',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    exclude: { path: '(^src/generated/)|(\\.test\\.ts$)' },
  },
};
