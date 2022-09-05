// This is the webpack which builds our extension in the 'dist' folder.
const path = require('path');
const webpack = require('webpack');

const autoprefixer = require('autoprefixer');
const outputPath = path.join(__dirname, 'dist');

const ContextMapPlugin = require('context-map-webpack-plugin');

const baseConfig = {
  devtool: 'source-map'
  // performance: {
  //   hints: false
  // }
};

const extensionConfig = {
  ...baseConfig,
  output: {
    strictModuleErrorHandling: true,
    strictModuleExceptionHandling: true,
    path: outputPath,
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  target: 'node',
  entry: {
    extension: './src/extension.ts'
  },
  resolve: {
    extensions: ['.js', '.ts', '.json'],
    fallback: {
      stream: require.resolve('stream-browserify')
    }
  },
  externals: {
    // The vscode-module is created on-the-fly and must be excluded.
    vscode: 'commonjs2 vscode',
    // Currently connection-model has a keytar dependency, vscode provides its
    // own keytar dependency. Here we are telling it to use vscode's keytar.
    keytar: 'keytar',
    electron: 'electron',
    snappy: 'commonjs2 snappy',
    'snappy/package.json': 'commonjs2 snappy/package.json',
    'bson-ext': 'commonjs2 bson-ext',
    'win-export-certificate-and-key': 'commonjs2 win-export-certificate-and-key',
    'os_dns_native': 'commonjs2 os_dns_native',
    'mongodb-client-encryption': 'commonjs2 mongodb-client-encryption',
    encoding: 'utf-8'
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
        options: {}
      },
      {
        test: /\.node$/,
        loader: 'node-loader'
      }
    ]
  },
  plugins: [
    new ContextMapPlugin(
      'node_modules/context-eval',
      ['./lib/context-node']
    )
  ]
};

const languageServerConfig = {
  ...baseConfig,
  output: {
    strictModuleErrorHandling: true,
    strictModuleExceptionHandling: true,
    path: outputPath,
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  target: 'node',
  entry: {
    languageServer: './src/language/server.ts'
  },
  optimization: {
    // Don't minimize in order to preserve
    // the signature names from @mongosh/shell-api.
    minimize: false
  },
  resolve: {
    extensions: ['.js', '.ts', '.json']
  },
  externals: {
    // The vscode-module is created on-the-fly and must be excluded.
    vscode: 'commonjs2 vscode',
    snappy: 'commonjs2 snappy',
    'snappy/package.json': 'commonjs2 snappy/package.json',
    'bson-ext': 'commonjs2 bson-ext',
    'win-export-certificate-and-key': 'commonjs2 win-export-certificate-and-key',
    'os_dns_native': 'commonjs2 os_dns_native',
    'mongodb-client-encryption': 'commonjs2 mongodb-client-encryption',
    encoding: 'utf-8'
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
        options: {}
      },
      {
        test: /\.node$/,
        loader: 'node-loader'
      }
    ]
  }
};

const languageServerWorkerConfig = {
  ...baseConfig,
  output: {
    strictModuleErrorHandling: true,
    strictModuleExceptionHandling: true,
    path: outputPath,
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  target: 'node',
  entry: {
    languageServerWorker: './src/language/worker.ts'
  },
  optimization: {
    // Don't minimize in order to preserve
    // the signature names from @mongosh/shell-api.
    minimize: false
  },
  resolve: {
    extensions: ['.js', '.ts', '.json']
  },
  externals: {
    // The vscode-module is created on-the-fly and must be excluded.
    vscode: 'commonjs2 vscode',
    snappy: 'commonjs2 snappy',
    'snappy/package.json': 'commonjs2 snappy/package.json',
    'bson-ext': 'commonjs2 bson-ext',
    'win-export-certificate-and-key': 'commonjs2 win-export-certificate-and-key',
    'os_dns_native': 'commonjs2 os_dns_native',
    'mongodb-client-encryption': 'commonjs2 mongodb-client-encryption',
    encoding: 'utf-8'
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
        options: {}
      },
      {
        test: /\.node$/,
        loader: 'node-loader'
      }
    ]
  }
};

const webviewConfig = {
  ...baseConfig,
  output: {
    strictModuleErrorHandling: true,
    strictModuleExceptionHandling: true,
    path: outputPath,
    filename: '[name].js',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  target: 'web',
  entry: {
    webviewApp: './src/views/webview-app/index.tsx'
  },
  resolve: {
    extensions: ['.js', '.ts', '.tsx', '.json'],
    fallback: {
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer')
    }
  },
  externals: {
    'mongodb-client-encryption': 'commonjs2 mongodb-client-encryption',
    'os_dns_native': 'commonjs2 os_dns_native',
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
        options: {}
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
              importLoaders: 1
            }
          },
          {
            loader: 'postcss-loader',
            options: {
              plugins: function() {
                return [autoprefixer()];
              }
            }
          },
          {
            loader: 'less-loader',
            options: {
              noIeCompat: true
            }
          }
        ]
      }
    ]
  },
  plugins: [
    new ContextMapPlugin(
      'node_modules/context-eval',
      ['./lib/context-node']
    ),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser'
    }),
  ]
};

module.exports = [
  extensionConfig,
  languageServerConfig,
  languageServerWorkerConfig,
  webviewConfig
];
