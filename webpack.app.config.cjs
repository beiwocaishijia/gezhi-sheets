const path = require('node:path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
module.exports = {
    mode: 'production',
    entry: './app/main.js',
    output: { path: path.resolve(__dirname, 'app-dist'), filename: 'app.js', clean: true },
    devtool: false,
    module: {
        rules: [
            { test: /\.css$/, use: ['style-loader', 'css-loader'] },
            { test: /\.(woff2?|ttf|eot)$/, type: 'asset/resource' },
        ],
    },
    plugins: [new HtmlWebpackPlugin({ template: './app/index.html' })],
    performance: { hints: false },
};
