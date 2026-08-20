# 火星编辑器 (Mars Editor)

Markdown 写作，一键转成**内联样式**富文本，粘贴到微信公众号编辑器即可无损还原。

微信公众号编辑器会丢弃 `class` 与 `<style>`，只保留内联 `style`。本项目的主题系统因此不产出任何 CSS 类，只产出内联样式字符串，保证预览与粘贴结果一致。

## 功能

- Markdown 实时预览，编辑区与预览区滚动同步
- 多套内置主题（浅色 / 深色纸底），可切换
- 排版密度三档（紧凑 / 标准 / 宽松），「标准」即主题原设计值
- 一键复制为公众号可用的富文本
- 图片本地存储（IndexedDB），粘贴 / 拖拽上传
- 代码高亮、脚注、`==高亮==` 等扩展语法

### 导入 / 导出

浏览器存储清掉就没了，所以草稿要能搬出去：

- **导入** `.md` / `.markdown` / `.txt`：每个文件建一篇草稿；`.zip`：按备份包整体还原
- **导出当前草稿 `.md`**：纯文本，图片引用保持 `![[名字]]`
- **导出全部备份 `.zip`**：草稿 + 图片原始文件 + `manifest.json`，可完整导回（zip 读写自己实现，压缩交给浏览器原生 `CompressionStream`，不引第三方库）
- **导出正文长图 `.png`**：750px 宽，正文直接画成一张图。走 `<foreignObject>` 序列化真实 DOM —— 正文样式全内联、图片全是 data URI，正好满足它的限制

## 待验证

`tools/wechat-paste-test.html` 是一页粘贴实测：分别复制 data URI 图片 / https 远程图片 / 图文混排 / 外链，
粘进公众号后台看哪些活下来。结论决定要不要给图片接图床（现在图片是 data URI 内嵌，
如果微信编辑器把它过滤掉，带图文章的「一键复制」就是断的）。

## 技术栈

React 19 · TypeScript · Vite 7 · CodeMirror 6 · markdown-it · highlight.js

## 开发

```bash
npm install
npm run dev      # 开发服务器
npm run build    # 类型检查 + 生产构建
npm run preview  # 预览构建产物
```
