# 火星编辑器 (Mars Editor)

Markdown 写作，一键转成**内联样式**富文本，粘贴到微信公众号编辑器即可无损还原。

微信公众号编辑器会丢弃 `class` 与 `<style>`，只保留内联 `style`。本项目的主题系统因此不产出任何 CSS 类，只产出内联样式字符串，保证预览与粘贴结果一致。

## 功能

- Markdown 实时预览，编辑区与预览区滚动同步
- 多套内置主题（浅色 / 深色纸底），可切换
- 一键复制为公众号可用的富文本
- 图片本地存储（IndexedDB），粘贴 / 拖拽上传
- 代码高亮、脚注、`==高亮==` 等扩展语法

## 技术栈

React 19 · TypeScript · Vite 7 · CodeMirror 6 · markdown-it · highlight.js

## 开发

```bash
npm install
npm run dev      # 开发服务器
npm run build    # 类型检查 + 生产构建
npm run preview  # 预览构建产物
```
