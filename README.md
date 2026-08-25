# Healthier

个人使用的本地优先健康饮食 PWA。应用以仓库内两本《你是你吃出来的》为主要规则来源，完成每日目标计算、HD1 餐食确认、营养区间、下一餐建议、七日总结和加密备份。

## 本地运行

```powershell
npm ci
npm run dev
```

固定检查：

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

生产部署固定采用：

- Vite `base: "/Healthier/"`
- React Router `HashRouter`
- GitHub Pages 地址：`/Healthier/#/`、`/Healthier/#/history` 等
- `.github/workflows/deploy.yml` 自动检查并部署 `dist`

首次部署前，需要在 GitHub 仓库的 **Settings → Pages → Build and deployment** 中选择 **GitHub Actions**。

## HD1 格式

```text
HD1|YYYYMMDD-HHmm|B/L/D/S|名称~分类~状态~最小值-最大值单位;...|烹调方式|备注
```

示例：

```text
HD1|20260825-1230|L|米饭~GR~CK~120-180g;西兰花~DV~CK~80-120g;鸡胸肉~MP~CK~60-90g|STIRFRY|油盐未知
```

导入后必须人工确认名称、分类、生熟状态、重量范围和单位。未知食物仍可参与食物组记录，但不会伪造营养值。

## 数据与规则边界

- `src/domain/rules/`：目标、日评价、周评价和建议，只接受已计算的事实，不读取数据库。
- `src/domain/nutrition/`：食物数据匹配与营养事实计算，不导入书本规则。
- `src/domain/meals/`：HD1 和餐食份量数据，不包含目标与评价。
- `src/db.ts`：Dexie/IndexedDB 本地持久化。
- `src/backup.ts`：PBKDF2-SHA-256（310,000 次）与 AES-256-GCM 加密备份。

内置食物值从 USDA Standard Reference 28 选取，保存稳定的 SR/NDB 编号、版本和英文原始描述。USDA 已将该类数据纳入 FoodData Central 的 SR Legacy 数据类型；当前种子数据明确标记 `SR28:<NDB编号>`，不把 NDB 编号冒充会随记录版本变化的 FDC ID。用户覆盖值标记为 `USER` 并单独保存在 IndexedDB。

## 书本依据

- [书本规则规格](docs/book-rules-spec.md)
- [PWA 设计](docs/pwa-design.md)
- [规则验算案例](docs/rule-fixtures.md)

应用只用于普通成年人日常自查。疾病、用药、孕产期、未成年人或进食障碍风险会触发安全门，不生成治疗性建议。
