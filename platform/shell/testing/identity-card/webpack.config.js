const { shareAll, withModuleFederationPlugin } = require('@angular-architects/module-federation/webpack');

const mfConfig = withModuleFederationPlugin({
  name: 'identity',
  // Classic container: the host's runtime loads remote entries via a <script> tag (type 'script'
  // is the default for loadRemoteModule({remoteEntry, remoteName, exposedModule})), which expects
  // window['identity'] from a classic script. The plugin's default (library type 'module') emits
  // an ESM remoteEntry that cannot parse as a classic script.
  library: { type: 'var', name: 'identity' },
  exposes: {
    './card': './platform/shell/testing/identity-card/src/app/identity-card.component.ts',
  },
  shared: {
    ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }),
  },
});

// remoteEntry.js is injected as a classic <script> tag at runtime, but Angular's webpack builder
// unconditionally sets output.scriptType: 'module', which makes webpack's auto-publicPath runtime
// emit `typeof import.meta.url` — a parse-time SyntaxError under a classic script tag that kills
// the remote before it registers. Force classic scripts so the runtime uses document.currentScript.
mfConfig.output.scriptType = false;

module.exports = mfConfig;
