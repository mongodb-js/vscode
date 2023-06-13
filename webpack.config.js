// This is the webpack which builds our extension in the 'dist' folder.
const path = require('path');
const webpack = require('webpack');

const autoprefixer = require('autoprefixer');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const { merge } = require('webpack-merge');

const { WebpackDependenciesPlugin } = require('@mongodb-js/sbom-tools');

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
      },
    },

    externals: {
      // The vscode-module is created on-the-fly and must be excluded.
      vscode: 'vscode',

      // Currently connection-model has a keytar dependency, vscode provides its
      // own keytar dependency. Here we are telling it to use vscode's keytar.
      keytar: 'keytar',

      // Electron:
      '@electron/remote': '@electron/remote',

      // MongoDB node driver externals:
      snappy: 'snappy',
      'snappy/package.json': 'snappy/package.json',
      'bson-ext': 'bson-ext',
      'win-export-certificate-and-key': 'win-export-certificate-and-key',
      'os-dns-native': 'os-dns-native',
      'mongodb-client-encryption': 'mongodb-client-encryption',
      'compass-preferences-model': 'compass-preferences-model',
    },
    plugins: [
      webpackDependenciesPlugin,
      ...(argv.analyze
        ? [
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
    optimization: {
      // Don't minimize in order to preserve
      // the signature names from @mongosh/shell-api.
      minimize: false,
    },
  });

  const languageServerWorkerConfig = merge(nodeTargetConfig(), {
    entry: {
      languageServerWorker: './src/language/worker.ts',
    },
    optimization: {
      // Don't minimize in order to preserve
      // the signature names from @mongosh/shell-api.
      minimize: false,
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
        {
          test: /\.less$/,
          exclude: [/\.global/, /bootstrap/, /node_modules/, /global\.less/],
          use: [
            { loader: 'style-loader' },
            {
              loader: 'css-loader',
              options: {
                modules: true,
                importLoaders: 1,
              },
            },
            {
              loader: 'postcss-loader',
              options: {
                plugins: function () {
                  return [autoprefixer()];
                },
              },
            },
            {
              loader: 'less-loader',
              options: {
                noIeCompat: true,
              },
            },
          ],
        },
      ],
    },
    plugins: [
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
