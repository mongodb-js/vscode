// This is the webpack which builds our connect form.
const path = require('path');

const autoprefixer = require('autoprefixer');

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
        test: /\.css$/,
        use: [{ loader: 'style-loader' }, { loader: 'css-loader' }]
      },
      // For styles that have to be global (see https://github.com/css-modules/css-modules/pull/65)
      {
        test: /\.less$/,
        include: [/global/, /bootstrap/],
        use: [
          { loader: 'style-loader' },
          {
            loader: 'css-loader',
            options: {
              modules: false
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


          // test: /\.less$/,
          // use: [
          //   {
          //     loader: 'style-loader'
          //   },
          //   {
          //     loader: 'css-loader'
          //   },
          //   {
          //     loader: 'less-loader',
          //     options: {
          //       noIeCompat: true
          //     }
          //   }
        ]
      }
    ]
  },
  performance: {
    hints: false
  }
};
