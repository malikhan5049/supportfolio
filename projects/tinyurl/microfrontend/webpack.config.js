const { shareAll, withModuleFederationPlugin } = require('@angular-architects/module-federation/webpack');

const mfConfig = withModuleFederationPlugin({
  // Classic container: the shell's runtime loads remote entries via a <script> tag, which expects
  // window['tinyurl'] from a classic script (same ruling as the old identity fixture).
  name: 'tinyurl',
  library: { type: 'var', name: 'tinyurl' },
  exposes: {
    './card': './projects/tinyurl/microfrontend/src/app/card/tinyurl-card.component.ts',
  },
  shared: {
    ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }),
  },
});

// Angular's webpack builder unconditionally sets output.scriptType: 'module'; a classic script
// tag cannot parse that runtime (see the identity fixture's comments before it was removed).
mfConfig.output.scriptType = false;

module.exports = mfConfig;
