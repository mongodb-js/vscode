// This is the webpack which builds our extension in the 'dist' folder.
const path = require('path');

const autoprefixer = require('autoprefixer');

const baseConfig = {
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map'
  // performance: {
  //   hints: false
  // }
};

const extensionConfig = {
  ...baseConfig,
  target: 'node',
  entry: {
    extension: './src/extension.ts'
  },
  resolve: {
    extensions: ['.js', '.ts', '.json']
  },
  externals: {
    // The vscode-module is created on-the-fly and must be excluded.
    vscode: 'commonjs vscode',
    // We just define electron as an external because it's a conditional dependency
    // in /Users/rhys/Documents/mongodb/vscode/node_modules/hadron-ipc/lib but we don't use it.
    electron: 'electron'
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
        test: /\.node$/,
        loader: 'node-loader'
      }
    ]
  }
};

const languageServerConfig = {
  ...baseConfig,
  target: 'node',
  entry: {
    languageServer: './src/language/server.ts'
  },
  resolve: {
    extensions: ['.js', '.ts', '.json']
  },
  externals: {
    // The vscode-module is created on-the-fly and must be excluded.
    vscode: 'commonjs vscode'
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
        test: /\.node$/,
        loader: 'node-loader'
      }
    ]
  }
};

const languageServerWorkerConfig = {
  ...baseConfig,
  target: 'node',
  entry: {
    languageServerWorker: './src/language/worker.ts'
  },
  resolve: {
    extensions: ['.js', '.ts', '.json']
  },
  externals: {
    // The vscode-module is created on-the-fly and must be excluded.
    vscode: 'commonjs vscode'
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
        test: /\.node$/,
        loader: 'node-loader'
      }
    ]
  }
};

const webviewConfig = {
  ...baseConfig,
  target: 'web',
  entry: {
    webviewApp: './src/views/webview-app/index.tsx'
  },
  resolve: {
    extensions: ['.js', '.ts', '.tsx', '.json']
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
              plugins: function () {
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
  }
};

module.exports = [
  extensionConfig,
  languageServerConfig,
  languageServerWorkerConfig,
  webviewConfig
];
