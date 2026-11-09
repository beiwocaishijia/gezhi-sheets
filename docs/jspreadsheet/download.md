title: 格知 AI · 下载与启动
keywords: 格知 AI, Gezhi Sheets, 下载, 本地运行
description: 从 GitHub 获取格知 AI 并在 Windows 上启动。

# 格知 AI · 下载与启动

从 [GitHub 仓库](https://github.com/beiwocaishijia/gezhi-sheets) 获取代码，或[下载源码 ZIP](https://github.com/beiwocaishijia/gezhi-sheets/archive/refs/heads/master.zip)。

需要 Windows 与 Node.js 22.13 或更新版本。

```powershell
git clone https://github.com/beiwocaishijia/gezhi-sheets.git
cd gezhi-sheets
npm ci
npm run dev
```

打开 [本地工作台](http://127.0.0.1:8001)。已安装依赖时，也可以双击 `启动jspreadsheet.cmd`。

配置五家模型、导入工作簿和使用六类 AI 功能，见 [格知 AI 使用指南](../USER-GUIDE.md)。
