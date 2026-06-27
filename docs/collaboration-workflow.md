# 协作工作流 (Collaboration Workflow)

## Git 分支策略

```
main (保护分支)
  └── feat/<feature-name>   # 新功能分支
  └── fix/<bug-description> # 修复分支
  └── refactor/<name>       # 重构分支
  └── docs/<name>           # 文档分支
```

- **`main`** — 保护分支，直接推送受限，必须通过 PR 合并
- **功能分支** — 从 `main` 创建，命名如 `feat/ai-translator`、`fix/sidebar-overflow`
- 保持分支短生命周期，及时合并避免冲突

## Commit 规范

格式: `<type>: <中文描述>`

| type | 场景 | 示例 |
|------|------|------|
| `feat` | 新功能/新工具 | `feat: 新增 AI Translator — OpenAI 兼容 API` |
| `fix` | Bug 修复 | `fix: 修复折叠分类视觉bug` |
| `chore` | 版本号、配置、杂项 | `chore: v1.0.12 changelog + bump version` |
| `refactor` | 重构（无行为变化） | `refactor: 提取 CheatSheet 组件` |
| `docs` | 文档 | `docs: 更新 README 工具列表` |
| `perf` | 性能优化 | `perf: 移除 crypto-js 依赖` |
| `style` | UI 调整（非功能） | `style: 重新设计设置页面` |
| `ci` | CI 配置 | `ci: 添加 GitHub Actions workflow` |

- 描述用 **中文**
- 可选使用 `—` 分隔动作与主题
- 单行提交，无 body/footer

## 发版流程

```
1. 更新 CHANGELOG.md
2. 更新 package.json version
3. git commit -m "chore: v<version> changelog + bump version"
4. git tag v<version>
5. git push && git push --tags
6. npm run release <version>   # 自动创建 GitHub Release
```

## Code Review 原则

- **功能分支 → main** 必须经过至少一位协作者 Review
- Review 重点：类型安全、CSS 兼容性（dark/light）、性能（避免不必要的渲染）
- 大变更拆分多个小 PR

## Issue 模板

已配置三种模板（中文）：
- `[Bug]` — Bug 报告
- `[Feature]` — 功能请求
- `[Question]` — 使用问题

> 空白 Issue 已禁用。

## 缺少的部分（TODO）

- [ ] PR 模板（`.github/PULL_REQUEST_TEMPLATE.md`）
- [ ] `CONTRIBUTING.md`
