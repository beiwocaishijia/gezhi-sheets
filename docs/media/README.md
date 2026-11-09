# 格知 AI 视觉素材

素材用于仓库 README；原图存放在 [`../assets/`](../assets/)，采用仓库内相对路径，不依赖临时图片链接。

## 文件

| 文件 | 用途与来源 |
| --- | --- |
| `logo.svg` | 原创四格标志：三个白色格子与一个略微上移的青绿色格子。应用图标与 README 统一使用。 |
| `hero-light.png` / `hero-dark.png` | 原创品牌封面；基于本项目实际截图制作的图像生成设计示意，随 GitHub 深浅主题切换。封面中的放大输入框、裁切与高亮属于视觉表达。 |
| `product-overview.png` | 本仓库实际工作台截图，展示三条合成客户反馈与两个新增结果字段。 |
| `demo.gif` | 实际浏览器操作录制，约十余秒：选区、生成、预览、应用、撤销。 |
| `feature-extract.png` | 实际表格中的原文与提取结果局部。 |
| `feature-text-to-table.png` | 实际文字转表的可编辑预览。 |
| `feature-formula.png` | 实际公式修改预览；逐行试算得到 350 和 190。 |
| `feature-preview.png` | 实际批量填列的完整修改预览。 |

所有截图均使用合成数据。演示 AI 响应由 `serve.cjs` 固定模拟，不接入任何真实账户，不证明厂商联通、模型速度或准确率。生产入口不会导入该夹具。

## 视觉方向

采用墨蓝 `#101f31`、青绿 `#087f70` 和浅色底，强调字体层级、留白与真实产品画面。参考 [Microsoft Excel](https://www.microsoft.com/en-us/microsoft-365/excel)、[Airtable](https://www.airtable.com/) 的产品呈现，以及 [Twenty](https://github.com/twentyhq/twenty)、[Teable](https://github.com/teableio/teable) 的 README 信息组织。未使用这些公司的 Logo、截图或品牌素材作为成品。

## 重录截图

```powershell
npm run build:app
node docs/media/serve.cjs
```

打开 `http://127.0.0.1:8004`。夹具使用单独临时目录、合成工作簿和固定模拟响应，不读写 `%LOCALAPPDATA%\CE-Lab`。默认配置中的 `readme-demo` 仅是演示模型名。

采用 Playwright 在 1440 × 900 视口录制；功能图直接对真实表格或预览对话框截图。GIF 使用 FFmpeg 转码为 1080 像素宽、8 fps、128 色循环动画，以控制仓库体积。重录后需同时检查小尺寸阅读、原文对应关系和模拟说明。
