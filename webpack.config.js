const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: './src/index.js',
    output: {
      filename: 'bundle.[contenthash].js',
      path: path.resolve(__dirname, 'dist'),
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.css$/i,
          use: [isProduction ? MiniCssExtractPlugin.loader : 'style-loader', 'css-loader'],
        },
        {
          test: /\.scss$/i,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
            'sass-loader',
          ],
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/index.html',
        filename: 'index.html',
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: 'src/favicon.png', to: 'favicon.png' },
          { from: 'src/apple-touch-icon.png', to: 'apple-touch-icon.png' },
        ],
      }),
      ...(isProduction
        ? [
            new MiniCssExtractPlugin({
              filename: 'styles.[contenthash].css',
            }),
          ]
        : []),
    ],
    devServer: {
      static: './dist',
      hot: true,
      open: true,
      allowedHosts: 'all',
    },
    optimization: {
      splitChunks: {
        chunks: 'all',
      },
    },
  };
};
