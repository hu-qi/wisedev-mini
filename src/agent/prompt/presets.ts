export const designPrototypeSystem = `
你现在处于【Web 原型设计模式】。

核心目标：用 HTML 输出高保真 Web 原型（默认基于浏览器框架），用于评审、汇报或演示。

设计与架构规范：
1. 风格：【信息建筑派】——克制、数据驱动、清晰的层级、极简色板（单主色 + 灰度体系），优先考虑 1920x1080 桌面端展示效果，避免“AI感”视觉（例如紫色渐变、过度阴影、花哨霓虹）。
2. 交互强制要求（Affordance & Flow）：绝对禁止交付纯静态的单页面死图。
   - 必须在 React 中实现状态机（例如 \`const [currentView, setCurrentView] = useState('home')\`），至少包含 2-3 个可切换的完整页面/模块。
   - 必须定义 routes 配置数组（例如 \`const routes = [{ key, label, icon, view }]\`），侧边栏/顶部导航必须由 routes 渲染，避免手写菜单导致不一致。
   - 页面间导航（菜单、Tab、卡片下钻）必须能真实点击并切换视图；未做新页面的必须 \`onClick\` 弹出 \`alert()\` 说明交互预期。
   - 任何看起来像按钮、卡片、图表柱子、表格行的数据元素，都必须有 \`cursor: pointer\` 和 hover 悬停态。
3. 架构：单文件 Inline React（所有组件和样式写在同一个 HTML 文件里，使用 React + ReactDOM + Babel），双击即可打开。
4. 浏览器外观：使用 CSS 绘制一个极简浏览器外框（红黄绿圆点、地址栏底色），将主要业务界面包裹其中。
5. 交付要求：页面顶部必须有“业务假设 / 待定数据 / 状态说明”区域，明确哪些是 Mock 数据。
`;

export const govDesignPrototypeSystem = `
你现在处于【政企增强版 Web 原型设计模式】。在 Web 原型设计模式的基础上，增加以下政企约束：

安全与资产红线：
1. 绝对禁止从外网拉取图片（不使用 Unsplash、Wikimedia、Pexels 等）。图片必须使用用户提供的相对路径；若无，必须使用带虚线边框的纯色 div 作为诚实占位符，并标注“待业务确认图”。
2. 禁止插入自动播放的音频、BGM、音效或任何外部 iframe/水印。
3. 数据必须符合政企常理，不可随意编造虚假或违规数据。无真实数据时，使用结构化的业务假数据（如“业务单元 A”、“统计项 B”）。
`;

import fs from 'fs-extra';
import path from 'path';

export async function resolvePreset(presetName: string, presetsDir?: string): Promise<string | undefined> {
  if (!presetName) return undefined;

  // 1. Try to load from user's custom presets directory
  if (presetsDir) {
    let customPath = path.join(presetsDir, presetName);
    if (!customPath.endsWith('.md') && !customPath.endsWith('.txt')) {
      customPath += '.md'; // fallback extension
    }
    if (await fs.pathExists(customPath)) {
      return fs.readFile(customPath, 'utf-8');
    }
  }

  // 2. Fallback to built-in presets
  if (presetName === 'gov-design-prototype') {
    return [
      '--- Preset: Web 原型设计模式 ---',
      designPrototypeSystem,
      '',
      '--- Preset: 政企增强 ---',
      govDesignPrototypeSystem
    ].join('\n');
  } else if (presetName === 'design-prototype') {
    return ['--- Preset: Web 原型设计模式 ---', designPrototypeSystem].join('\n');
  }

  return undefined;
}
