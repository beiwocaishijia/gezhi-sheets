const path = require('node:path');
const os = require('node:os');
const express = require('express');
const fs = require('node:fs');
const { createApp } = require('./app.cjs');
async function main() {
    if (!process.argv.includes('--dev') && !fs.existsSync(path.join(__dirname, '..', 'app-dist', 'index.html')))
        throw new Error('请先运行 npm run build:app，或使用 npm run dev 启动开发版本');
    const root = process.env.CE_LAB_DATA_DIR || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share'), 'CE-Lab');
    const { app } = await createApp({ root });
    if (process.argv.includes('--dev')) {
        const webpack = require('webpack');
        const middleware = require('webpack-dev-middleware');
        const config = require('../webpack.app.config.cjs');
        config.mode = 'development';
        const compiler = webpack(config);
        app.use(middleware(compiler, { publicPath: '/', stats: 'errors-warnings' }));
    } else app.use(express.static(path.join(__dirname, '..', 'app-dist')));
    const port = Number(process.env.PORT || 8001);
    const server = app.listen(port, '127.0.0.1', () => console.log(`格知 AI ready: http://127.0.0.1:${port}`));
    server.on('error', (e) => {
        console.error(e.code === 'EADDRINUSE' ? `端口 ${port} 已占用，请停止旧的 格知 AI 预览后重试。` : '启动失败：' + e.message);
        process.exitCode = 1;
    });
}
if (require.main === module)
    main().catch((e) => {
        console.error('格知 AI 启动失败：' + e.message);
        process.exitCode = 1;
    });
