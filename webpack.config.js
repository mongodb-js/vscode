// This is the webpack which builds our connect form.
const path = require('path');

module.exports = {
  entry: {
    connectForm: './src/views/connect-form-app/index.tsx'
  },
  output: {
    path: path.resolve(__dirname, 'connect-form'),
    filename: '[name].js'
  },
  devtool: 'eval-source-map',
  resolve: {
    extensions: ['.js', '.ts', '.tsx', '.json']
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        loader: 'ts-loader',
        options: {}
      },
      {
        test: /\.less$/,
        use: [
          {
            loader: 'style-loader'
          },
          {
            loader: 'css-loader'
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
  performance: {
    hints: false
  }
};
