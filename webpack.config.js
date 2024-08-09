// This is the webpack which builds our extension in the 'dist' folder.
const path = require('path');
const webpack = require('webpack');

const autoprefixer = require('autoprefixer');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const DuplicatePackageCheckerPlugin = require('duplicate-package-checker-webpack-plugin');
const { merge } = require('webpack-merge');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

const { WebpackDependenciesPlugin } = require('@mongodb-js/sbom-tools');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (env, argv) => {
  const outputPath = path.join(__dirname, 'dist');

  const webpackDependenciesPlugin = new WebpackDependenciesPlugin({
    outputFilename: path.resolve(__dirname, '.sbom', 'dependencies.json'),
  });

  // here we use a function instead of a constant to make sure that if we want to share references
  // to some object (ie. a plugin) we are doing it intentionally.
  const baseConfig = () => ({
    devtool: 'source-map',

    resolve: {
      alias: {
        // Removes `browserslist` that is pulled in by `babel` and is unnecessary
        // as well as being a particularly large dependency.
        browserslist: false,

        // Removes `ampersand-sync`: `ampersand-sync` is required by `ampersand-model` which is temporarily
        // still used by some files inside `mongodb-data-service` (although not needed for the VSCode extension).
        //
        // `ampersand-sync` brings into the bundle a number of other dependencies that are outdated and having
        // known vulnerabilities.
        //
        // This alias can be removed once `mongodb-data-service` will not include `mongodb-connection-model` anymore.
        'ampersand-sync': false,

        // Removes `electron`: is an optional dependency of `oidc-plugin`, but also installed as dev-dep,
        // webpack would bring it inside the bundle otherwise.
        electron: false,

        // We don't currently support kerberos in our extension.
        kerberos: false,

        // Optional native-addon dependencies of ssh2
        'cpu-features': false,
        './crypto/build/Release/sshcrypto.node': false,
      },
    },

    externals: {
      // The vscode-module is created on-the-fly and must be excluded.
      vscode: 'vscode',

      // Currently connection-model has a keytar dependency, vscode provides its
      // own keytar dependency. Here we are telling it to use vscode's keytar.
      keytar: 'keytar',

      // Electron:
      electron: 'electron',
      '@electron/remote': '@electron/remote',
      'hadron-ipc': 'hadron-ipc',

      // MongoDB node driver externals:
      snappy: 'snappy',
      'snappy/package.json': 'snappy/package.json',
      'bson-ext': 'bson-ext',
      'win-export-certificate-and-key': 'win-export-certificate-and-key',
      'os-dns-native': 'os-dns-native',
      'mongodb-client-encryption': 'mongodb-client-encryption',
      'compass-preferences-model': 'compass-preferences-model',
      '@mongodb-js/zstd': '@mongodb-js/zstd',
      'gcp-metadata': 'gcp-metadata',
      encoding: 'encoding',
    },
    optimization: {
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            output: { ascii_only: true },
            // Not keeping classnames breaks shell-api during minification
            keep_classnames: true,
            compress: {
              // The 'bindings' package relies on `error.stack;` having side effects.
              pure_getters: false,
            },
          },
        }),
      ],
    },
    plugins: [
      webpackDependenciesPlugin,
      ...(argv.analyze
        ? [
            new DuplicatePackageCheckerPlugin(),
            new BundleAnalyzerPlugin({
              analyzerPort: 'auto',
            }),
          ]
        : []),
    ],
    output: {
      strictModuleErrorHandling: true,
      strictModuleExceptionHandling: true,
      path: outputPath,
      filename: '[name].js',
      library: {
        type: 'commonjs',
      },
      devtoolModuleFilenameTemplate: '../[resource-path]',
    },
  });

  const nodeTargetConfig = () =>
    merge(baseConfig(), {
      target: 'node',
      resolve: {
        extensions: ['.js', '.ts', '.json'],
      },
      module: {
        rules: [
          {
            test: /\.mjs$/,
            include: /node_modules/,
            type: 'javascript/auto',
          },
          {
            test: /\.(ts|tsx)$/,
            loader: 'ts-loader',
            exclude: /node_modules/,
            options: {},
          },
          {
            test: /\.node$/,
            loader: 'node-loader',
          },
        ],
      },
    });

  const extensionConfig = merge(nodeTargetConfig(), {
    externals: {
      // @mongodb-js/connection-form pulls in a number of large front dependencies.
      // It's used in the webview, but gets pulled into the main extension so we exclude
      // the large onces here since we do use adjustConnectionOptionsBeforeConnect from it.
      '@mongodb-js/compass-components': '@mongodb-js/compass-components',
      '@mongodb-js/compass-editor': '@mongodb-js/compass-editor',
    },
    experiments: {
      // required for `bson`
      topLevelAwait: true,
    },
    entry: {
      extension: './src/extension.ts',
    },
  });

  const languageServerConfig = merge(nodeTargetConfig(), {
    entry: {
      languageServer: './src/language/server.ts',
    },
  });

  const languageServerWorkerConfig = merge(nodeTargetConfig(), {
    entry: {
      languageServerWorker: './src/language/worker.ts',
    },
  });

  const webviewConfig = merge(baseConfig(), {
    target: 'web',
    entry: {
      webviewApp: './src/views/webview-app/index.tsx',
    },
    resolve: {
      extensions: ['.js', '.ts', '.tsx', '.json'],
      // This is here to deal with some node.js code brought in by
      // @leafygreen/logo via @emotion/server:
      fallback: {
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer'),
        crypto: require.resolve('crypto-browserify'),
        path: require.resolve('path-browserify'),
        mongodb: false,
      },
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          loader: 'ts-loader',
          exclude: /node_modules/,
          options: {},
        },
      ],
    },
    plugins: [
      // This plugin has been added to avoid Out of memory crashes of webpack on
      // our Github runners. It does so by moving the type checking to a
      // separate process.
      new ForkTsCheckerWebpackPlugin(),
      // This is here to deal with some node.js code brought in
      // by @leafygreen/logo via @emotion/server:
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
        process: 'process/browser',
      }),
    ],
  });

  return [
    extensionConfig,
    languageServerConfig,
    languageServerWorkerConfig,
    webviewConfig,
  ];
};
