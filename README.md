<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/hero-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="docs/assets/hero-light.png">
  <img alt="格知 AI · Gezhi Sheets — 让表格听懂你的话。" src="docs/assets/hero-light.png" width="100%">
</picture>

<div align="center">

# 格知 AI · Gezhi Sheets

**从一句话，到一张好表。**

选中数据，说出需求。让 AI 提取、整理和计算，再由你确认写入。

[![License: MIT](https://img.shields.io/badge/license-MIT-087f70?style=flat-square)](LICENSE) [![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-101f31?style=flat-square)](package.json) [![Models](https://img.shields.io/badge/模型接入-5_家-087f70?style=flat-square)](#模型由你选择) [![Tests](https://img.shields.io/badge/tests-144_passed-101f31?style=flat-square)](docs/VALIDATION.md)

[看它如何工作](#看它如何工作) · [六类能力](#从零散信息到可用数据) · [快速开始](#快速开始) · [使用文档](docs/CE-LAB.md)

</div>

<br>

## 看它如何工作

客户说的是原话，你需要的是可以跟进的记录。选中几条反馈，输入“提取需求类别和一句话摘要”，检查结果后，就能把两列信息写回原记录旁边。

![格知 AI 实际工作台：原始客户反馈与生成的需求类别、需求摘要](docs/assets/product-overview.png)

<p align="center"><sub>实际运行界面 · 合成示例数据 · AI 响应由演示夹具模拟</sub></p>

### 先看结果，再决定写入

**选择范围 → 描述需求 → 生成预览 → 确认应用 → 一次撤销**

![实际页面操作录制：选中三条反馈，生成预览，应用新列，再撤销恢复](docs/assets/demo.gif)

<p align="center"><sub>真实页面交互录制，使用固定模拟响应；不代表真实模型的速度、准确率或联通状态。</sub></p>

## 从零散信息，到可用数据

<table>
<tr>
<td width="50%" valign="top">
<h3>一列资料，批量处理</h3>
<p>提取信息、分类、摘要、翻译。输出多个字段，逐行对应原文；默认新增列，方便核对。</p>
<img src="docs/assets/feature-extract.png" alt="真实表格局部：客户原话与两个结果字段" width="100%">
</td>
<td width="50%" valign="top">
<h3>一段文字，变成记录</h3>
<p>把订单、清单和留言拆成表格。列名与内容可以在预览中编辑，再新建工作表或映射追加。</p>
<img src="docs/assets/feature-text-to-table.png" alt="文字订单转表格的可编辑预览" width="100%">
</td>
</tr>
<tr>
<td width="50%" valign="top">
<h3>用中文，表达计算</h3>
<p>说“数量乘单价”，生成公式并逐行试算。支持解释与排错，计算交给程序完成。</p>
<img src="docs/assets/feature-formula.png" alt="生成金额公式并显示逐行试算结果" width="100%">
</td>
<td width="50%" valign="top">
<h3>每一次修改，都看得见</h3>
<p>对照原值、建议值与目标位置。应用后可以一次撤销；数据变动时，过期预览会被阻止。</p>
<img src="docs/assets/feature-preview.png" alt="完整修改预览中的目标位置、原内容与建议内容" width="100%">
</td>
</tr>
</table>

| 能力 | 试着这样说 |
| --- | --- |
| **批量填列** | “提取需求类别和摘要，未提到的预算留空。” |
| **文字转表** | “把这段订单整理成客户、商品、数量和单价。” |
| **整理数据** | “统一供应商名称，标记疑似重复并说明理由。” |
| **表格问答** | “按供应商汇总采购金额，列出前五名。” |
| **公式助手** | “数量乘单价，在新列计算每笔金额。” |
| **操作表格** | “按金额从高到低排序，把未付款记录标黄。” |

整理建议可逐项选择；疑似重复只标记，不自动删除。统计使用受限查询计划，由程序执行筛选、分组、计数、求和、平均与排序。含糊的操作会先追问。

## 模型，由你选择

**GLM · Kimi · 豆包 · DeepSeek · Qwen 千问**

每家都有独立的 API Key 与模型配置。支持搜索预设、手动输入模型 ID，以及厂商支持时读取模型列表；记住上次选择，不自动跨厂商切换。

| 厂商 | 接入方式 |
| --- | --- |
| GLM / 智谱 | 官方普通模型 API |
| Kimi / 月之暗面 | 官方 API，支持读取模型列表 |
| 豆包 / 火山方舟 | 支持模型 ID 或推理接入点 ID |
| DeepSeek | 官方 API，支持读取模型列表 |
| Qwen / 千问 | 默认北京地域，支持高级地域与工作空间地址 |

API Key 在本机通过 **Windows DPAPI** 加密保存，重启后可继续使用。工作簿保存在本机；发起 AI 任务时，只把指定范围交给你选择的厂商。

> 五家适配器已通过协议模拟测试。真实账户连接及业务效果仍需填入各自 Key 验证；预设模型不代表账户已开通。

## 从这些日常工作开始

| 你手里的资料 | 整理之后 |
| --- | --- |
| 客户留言、客服记录 | 需求类别、核心诉求、待确认事项 |
| 商品参数、英文说明 | 统一简介、提取字段、整列翻译 |
| 订单文字、采购备注 | 结构化记录、金额公式、分类汇总 |
| 会议纪要、工作清单 | 任务、负责人、截止时间；缺失信息留空 |

## 快速开始

需要 **Windows + Node.js 22.13 或更新版本**。这是本机工作台，首版不包含账号系统和多人协作。

```powershell
git clone https://github.com/beiwocaishijia/gezhi-sheets.git
cd gezhi-sheets
npm ci
npm run dev
```

打开 **[http://127.0.0.1:8001](http://127.0.0.1:8001)**。

1. 点击 **模型设置**，选择一家厂商，填写 API Key 与模型 ID，再测试连接。
2. 点击 **加载反馈示例**，或导入自己的 `.xlsx`、CSV，也可以直接从 Excel 粘贴。
3. 选择区域，输入要求，生成并检查预览，最后点击 **应用**。

安装依赖后，也可以双击项目里的 **`启动格知 AI.cmd`**。

<details>
<summary><strong>生产启动与开发检查</strong></summary>

```powershell
npm run build:app
npm start

npm run test:component
npm run test:ai
npx playwright install chromium --only-shell
npm run test:browser
npm run lint
```

现有验证共 **144 项通过**：98 项组件回归（包含原有 93 项）、37 项后端与适配测试、9 项浏览器流程测试。详见 [验收记录](docs/VALIDATION.md)。

</details>

## 文件与数据

- **Excel / CSV**：导入前检查工作表、列标题和类型；支持多工作表导出与文本编号前导零。
- **自动保存**：防抖保存、版本检查、原子替换与上一份有效备份；保存失败可重试。
- **明确范围**：默认处理选区，整表分析需主动切换；每张表以 1000 行以内为目标。
- **可控修改**：只读保护、结构操作检查、分批进度、取消与失败批次重试。

<details>
<summary><strong>使用边界与兼容说明</strong></summary>

每张工作表最多 1000 行、100 列，每个工作簿最多 20 张表；Excel / CSV 导入上限 10 MB。

支持单元格数据、多工作表和白名单公式，不保证宏、图表、复杂排版完整还原。不支持的导入公式使用可用缓存值并提示。

公式首版支持 `SUM`、`AVERAGE`、`MIN`、`MAX`、`COUNT`、`COUNTA`、`IF`、`ROUND`、`ABS`、`AND`、`OR`、`NOT` 以及基础运算和当前表引用。

本机数据继续沿用 `%LOCALAPPDATA%\CE-Lab`，已有工作簿与密钥无需迁移。AI 语义结果仍需结合原文核对；模型费用与配额由对应厂商提供。

</details>

## 文档与开发

| 文档 | 内容 |
| --- | --- |
| [使用与开发说明](docs/CE-LAB.md) | 六类任务、模型配置、文件兼容、保存恢复、接口 |
| [验收记录](docs/VALIDATION.md) | 回归覆盖范围与五家真实连接状态 |
| [组件扩展](docs/COMPONENT-EXTENSIONS.md) | 事务撤销、显式文本与公式修复 |
| [视觉素材说明](docs/media/README.md) | 品牌素材、截图与模拟演示的制作方式 |

前端使用原生 JavaScript 与 Webpack；后端使用 Node.js、Express、原生 `fetch` 和 Zod。文件处理采用 ExcelJS 与 Papa Parse，数值统计使用 Decimal。

## 维护与许可证

格知 AI 由 [beiwocaishijia](https://github.com/beiwocaishijia) 维护。

许可证详见 **[MIT License](LICENSE)**。品牌封面为原创设计示意；其余产品截图与操作演示来自本仓库实际页面。
