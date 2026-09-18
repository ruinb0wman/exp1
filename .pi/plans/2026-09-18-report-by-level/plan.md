# 报告按等级聚合：每个 level 的完成率与存活率

日期：2026-09-18
范围：`src/libs/task.ts`（判据唯一化）、`src/libs/report/{types,aggregate,renderMarkdown,prompt}.ts`、
`src/pages/Reports/{index.tsx,lib.ts,components/LevelTable.tsx}`、`src/locales/{zh,en}.json` + 单测
不涉及：无 Rust / tauri 改动，**不新增依赖**，不动 DB schema（`level` 字段上一轮已落地）。

---

## 0. 目标与已确认的决策

在**分析报告**里加一节「按等级」：每个 level 的计划 / 完成 / 完成率 + 有任务天数 / 全清天数 / 存活率。

用户已确认的四项：

| 决策点 | 选择 |
|---|---|
| 口径 | **完成率 + 全清天数/存活率**（两个都给） |
| 等级归属 | **按当前模板等级**（改等级后历史一起重算），回退实例快照，最后兜底 1 |
| 出现位置 | 分析报告页新增小节 + Markdown / JSON 导出同步 |
| 小节位置 | **追加为 §8「按等级」**，现有 1~7 节编号不动，分析提示词 8 → 9 |

关键理由（小节位置）：你的知识库按**节号**引用这份报告 ——
`pages/ai辅助-年报模板.md:14-18` 写着「报告第 1 / 4 节：专注总分钟」「第 6 节：最活跃星期」「第 1 / 7 节：积分…」，
`pages/exp1.md:23` 写着「3. 任务明细」。追加到末尾后这些引用**全部仍然有效**，知识库一行都不用改；
只有「分析提示词」从 8 变 9，而 KB 没有引用过这个号。

**不做**（用户未选，避免顺手扩范围）：日历页当天列表的小计、Profile 页统计区、按等级 × 时间的趋势图。

---

## 1. 现状（已读代码）

- 数据源现成：`reportService.loadReportSources` 已经加载**实时模板表**
  （`reportService.ts:29` `db.taskTemplates.where('userId').equals(userId).toArray()`）→ `ReportSources.templates`。
  实例里另有 `template` 快照。两份都有 `level`。
- 现有聚合只有两个维度：`TrendBucket`（按天/周）与 `TemplateBucket`（按模板），
  完成率口径是 `completed / planned`（`aggregate.ts:395`）。**没有「等级」维度**。
- `computePeriodAggregate` 已经把本期与上期都算了一遍（`aggregateReport` 里 `current` / `previous`），
  所以「上期的等级表」几乎免费，不需要额外查询。
- 渲染层小节编号是**硬编码**的（`renderMarkdown.ts` 里 `## 1.` ~ `## 7.` + `prompt.ts:12` 的 `## 8.`），
  且 `renderMarkdown.test.ts` 明确断言了这些编号。
- `libs/task.ts` 的 `resolveLevel` 是**私有**的，且「缺失/非法 → `Number.MAX_SAFE_INTEGER`」——
  那是**排序**语义（缺失排最后），报表要的是「兜底 1」，两者不能各写一份判据。

---

## 2. 改法

### 2.1 等级判据唯一化：`src/libs/task.ts`

把「什么算合法 level」抽成一个导出函数，排序与报表共用（避免出现第二份 `level > 0 && isFinite` 判断）：

```ts
/**
 * 执行等级是否合法（正整数）
 *
 * 排序（缺失排到最后）与报表按等级分组（缺失兜底 1）共用这一个判据。
 */
export function isValidLevel(level: unknown): level is number {
  return typeof level === 'number' && Number.isFinite(level) && level > 0;
}

/** 缺失/非法 level 时排到最后（旧数据/手工构造对象） */
const MISSING_LEVEL = Number.MAX_SAFE_INTEGER;

function resolveLevel(template: TaskTemplate): number {
  return isValidLevel(template.level) ? template.level : MISSING_LEVEL;
}
```

### 2.2 类型：`src/libs/report/types.ts`

新增 `LevelBucket`（放在 `TemplateBucket` 之后）：

```ts
/**
 * 按执行等级聚合
 *
 * 等级取**当前模板表**的 level（改等级后历史一起重算），拿不到时回退实例快照，
 * 最后兜底 1；已配置的等级即使本期没有任务也会出现在结果里（便于跨周期对比）。
 */
export interface LevelBucket {
	level: number;
	planned: number;
	completed: number;
	skipped: number;
	pending: number;
	overdue: number;
	/** 完成率 = completed ÷ planned，分母为 0 时为 null */
	completionRate: number | null;
	/** 该等级有计划实例的用户日数 */
	activeDays: number;
	/** 该等级当天全部计划实例都完成的天数（跳过不算清完） */
	clearedDays: number;
	/** 存活率 = clearedDays ÷ activeDays，分母为 0 时为 null */
	survivalRate: number | null;
}
```

`ReportModel` 增加两个字段（`templates` 之后）：

```ts
	levels: LevelBucket[];
	previousLevels: LevelBucket[];
```

`previousLevels` 只进 JSON（见 §2.4 说明），不塞进 UI / Markdown 表格。

### 2.3 聚合：`src/libs/report/aggregate.ts`

`PeriodAggregate` 接口加 `levels: LevelBucket[]`，并在 `computePeriodAggregate` 的
**「按模板聚合」之后、「习惯洞察」之前**插入：

```ts
	// ===== 按执行等级聚合 =====
	const levelByTemplateId = new Map<string, number>();
	for (const template of sources.templates) {
		if (template.id && isValidLevel(template.level)) {
			levelByTemplateId.set(template.id, template.level);
		}
	}

	/** 实例所属等级：优先当前模板表（改等级后历史一起重算），回退实例快照，最后兜底 1 */
	const resolveInstanceLevel = (instance: TaskInstance): number => {
		const live = levelByTemplateId.get(instance.templateId);
		if (isValidLevel(live)) return live;
		const snapshot = instance.template?.level;
		return isValidLevel(snapshot) ? snapshot : 1;
	};

	const levelBuckets = new Map<number, LevelBucket>();
	const ensureLevel = (level: number): LevelBucket => {
		const existing = levelBuckets.get(level);
		if (existing) return existing;
		const created: LevelBucket = {
			level,
			planned: 0, completed: 0, skipped: 0, pending: 0, overdue: 0,
			completionRate: null,
			activeDays: 0, clearedDays: 0, survivalRate: null,
		};
		levelBuckets.set(level, created);
		return created;
	};

	// 先建出所有「已配置」的等级：本期没有任务的等级也会出现（planned=0、比率为 null），
	// 这样周报/月报/年报的等级行数一致，可以直接对比。
	for (const level of levelByTemplateId.values()) ensureLevel(level);

	/** level → (用户日 → 当天该等级的计划/完成数)，用于「全清天数」 */
	const levelDayStats = new Map<number, Map<string, { planned: number; completed: number }>>();

	for (const instance of periodInstances) {
		const level = resolveInstanceLevel(instance);
		const bucket = ensureLevel(level);
		bucket.planned += 1;
		if (instance.status === 'completed') bucket.completed += 1;
		else if (instance.status === 'skipped') bucket.skipped += 1;
		else bucket.pending += 1;
		if (isInstanceOverdue(instance, dayEndTime, nowMs)) bucket.overdue += 1;

		if (!instance.instanceDate) continue; // 无日期实例没有「天」，不进全清/存活统计
		let byDay = levelDayStats.get(level);
		if (!byDay) {
			byDay = new Map();
			levelDayStats.set(level, byDay);
		}
		const day = byDay.get(instance.instanceDate) ?? { planned: 0, completed: 0 };
		day.planned += 1;
		if (instance.status === 'completed') day.completed += 1;
		byDay.set(instance.instanceDate, day);
	}

	for (const [level, byDay] of levelDayStats) {
		const bucket = ensureLevel(level);
		bucket.activeDays = byDay.size;
		bucket.clearedDays = Array.from(byDay.values()).filter(
			(day) => day.planned > 0 && day.completed === day.planned
		).length;
	}

	const levels = Array.from(levelBuckets.values()).sort((a, b) => a.level - b.level);
	for (const bucket of levels) {
		bucket.completionRate = bucket.planned > 0 ? bucket.completed / bucket.planned : null;
		bucket.survivalRate = bucket.activeDays > 0 ? bucket.clearedDays / bucket.activeDays : null;
	}
```

返回对象加 `levels`；`aggregateReport` 的返回值加：

```ts
		levels: current.levels,
		previousLevels: previous.levels,
```

（`previous.levels` 自动使用同一套「已配置等级」集合，因为 `sources.templates` 与本期相同。）

### 2.4 渲染：`src/libs/report/renderMarkdown.ts`

新增 `renderLevels`（风格与 `renderTemplates` 一致，空时返回 `t('reports.empty')`）：

```ts
/** 渲染按等级小节 */
function renderLevels(model: ReportModel, t: ReportTranslate): string {
	if (model.levels.length === 0) return t('reports.empty');

	const header = `| ${t('reports.levels.col.level')} | ${t('reports.levels.col.planned')} | ${t('reports.levels.col.completed')} | ${t('reports.levels.col.completionRate')} | ${t('reports.levels.col.activeDays')} | ${t('reports.levels.col.clearedDays')} | ${t('reports.levels.col.survivalRate')} |`;
	const divider = '| --- | ---: | ---: | ---: | ---: | ---: | ---: |';
	const body = model.levels.map(
		(bucket) =>
			`| L${bucket.level} | ${bucket.planned} | ${bucket.completed} | ${formatRate(bucket.completionRate)} | ${bucket.activeDays} | ${bucket.clearedDays} | ${formatRate(bucket.survivalRate)} |`
	);

	return [header, divider, ...body].join('\n');
}
```

在 `renderReportMarkdown` 里，**§7 其他之后**插入（提示词之前）：

```ts
	sections.push(`## 8. ${t('reports.section.levels')}`);
	sections.push('');
	sections.push(renderLevels(model, t));
	sections.push('');
```

并给口径说明加一条（`caliber.item7`，说明等级怎么归类、跳过不算清完）：

```ts
			t('reports.caliber.item7'),
```

「L{level}」直接拼字符串、不做 i18n key —— 与卡片/列表上的徽标一致（那里也是 `L{level}` 字面量）。

### 2.5 提示词：`src/libs/report/prompt.ts`

- `## 8. ${t('reports.section.prompt')}` → `## 9. ...`
- `lines` 数组末尾加 `t('reports.prompt.requirement5')`，内容让 LLM 重点看等级差异
  （低等级没守住 / 高等级是否被挤压）——否则这一节数据等于白加。

### 2.6 UI：`src/pages/Reports/`

**`lib.ts`** 抽出两处会被两个表共用的格式化（现在只在 `TemplateTable.tsx` 里）：

```ts
/** 完成率/存活率格式化：null → — */
export function formatRate(rate: number | null): string;

/** 比率配色：>=80% 绿、>=50% 常规、其余 primary（与任务明细表一致） */
export function rateClass(rate: number | null): string;
```

**新增 `components/LevelTable.tsx`**：与 `TemplateTable` 同款结构（`overflow-x-auto scrollbar-hide`、
`min-w-[560px]`、7 列），首列用等级徽标（复用 `levelBadgeClass`，`import { levelBadgeClass } from '@/pages/AllTasks/lib'`）+
`L{n}` 文本；完成率与存活率都走 `rateClass`。列顺序与用户确认的预览一致：
`等级 | 计划 | 完成 | 完成率 | 有任务天数 | 全清天数 | 存活率`。

**`index.tsx`**：在「任务明细」小节之后、「说明」之前插入一节（UI 没有编号，不涉及 §8 的顺序问题）：

```tsx
<section>
  <h2 className="text-text-primary font-bold mb-3">{t('reports.section.levels')}</h2>
  <div className="rounded-xl bg-surface p-4 border border-border">
    <LevelTable levels={model.levels} />
  </div>
</section>
```

> UI 里它紧跟任务明细（信息密度上更顺手），Markdown 里它是 §8（保知识库引用）——两者顺序不同是**刻意的**，
> 因为 UI 只呈现 9 节中的 4 节，不存在编号不一致。

### 2.7 i18n：`src/locales/{zh,en}.json`（两文件同步）

- `reports.section.levels`：`按等级` / `By level`
- `reports.levels.col.{level,planned,completed,completionRate,activeDays,clearedDays,survivalRate}`：
  `等级/计划/完成/完成率/有任务天数/全清天数/存活率` / `Level/Planned/Completed/Completion rate/Days with tasks/Cleared days/Survival rate`
- `reports.caliber.item7`：
  「按等级表：等级取任务当前设置的 level（改等级后历史报告一起重算）；完成率 = 完成实例 ÷ 计划实例；全清天数 = 该等级当天全部计划实例都完成的天数（跳过不算清完），存活率 = 全清天数 ÷ 有任务天数；无日期实例不参与。」
- `reports.prompt.requirement5`：
  「5. 对比各等级的完成率与存活率：低等级（L1）没守住时优先指出，并说明它是否挤压了更高等级的执行。」

---

## 3. 实施步骤（每步可独立验证）

| # | 步骤 | 触及文件 | 验证 |
|---|---|---|---|
| 1 | `isValidLevel` 导出 + `resolveLevel` 改用它 | `src/libs/task.ts` | `bunx tsc --noEmit`、`bunx vitest run src/libs/task.test.ts` |
| 2 | 类型：`LevelBucket` + `ReportModel.levels/previousLevels` | `src/libs/report/types.ts` | tsc 报错点正好是待补的 `aggregate` 返回值与两个测试工厂 |
| 3 | 聚合：按等级分桶 + 全清/存活 + 上期等级表 | `src/libs/report/aggregate.ts` | 新 `describe('aggregateReport - 按等级')` |
| 4 | Markdown：`renderLevels` + §8 + 口径 item7 | `src/libs/report/renderMarkdown.ts` | `bunx vitest run src/libs/report/renderMarkdown.test.ts` |
| 5 | 提示词：§9 + requirement5 | `src/libs/report/prompt.ts` | 同上（节号断言） |
| 6 | UI：`formatRate/rateClass` 抽出 + `LevelTable` + 页面小节 | `src/pages/Reports/{lib.ts,index.tsx,components/*}` | `bunx tsc --noEmit` + 手测 |
| 7 | i18n 四组键（zh/en 同步） | `src/locales/{zh,en}.json` | `bunx vitest run src/locales` |
| 8 | 全量回归 | — | `bunx tsc --noEmit`、`bunx vitest`、`bun run build` |
| 9 | 真浏览器手测 | — | 见下 |

手测清单（`bun run dev` + bow，造 3 个不同等级的任务与几天实例）：

1. 报告页（周）：出现「按等级」小节，`L1/L2/L3` 三行，完成率/存活率与手算一致，徽标配色与列表页一致。
2. 把某个任务从 L3 改成 L1 → 报告里它的实例从 L3 行挪到 L1 行（**实时模板表**生效，不是快照）。
3. 某天把 L1 的任务全部完成 → 该天计入 L1 的「全清天数」；只完成一半 → 不计入，但仍在「有任务天数」里。
4. 跳过（skip）一个任务的那天不算全清。
5. 导出 Markdown：§8 是「按等级」表、§9 是「分析提示词」，1~7 节标题与编号与改前完全一致。
6. 导出 JSON：含 `levels` 与 `previousLevels`。

---

## 4. 测试清单

- **`src/libs/report/aggregate.test.ts`** 新增 `describe('aggregateReport - 按等级')`（自带 sources，参考「空数据与天界」的写法）：
  - 两个等级各自的 `planned/completed/completionRate`，且**按 level 升序**
  - 全清天数与存活率：L1 两天全清（2/2）、L2 一天全清一天缺一个（1/2）
  - `skipped` 不算清完（当天 planned=2、completed=1、skipped=1 → 不算）
  - 已配置但本期无实例的等级出现在结果里：`planned=0`、两个比率都是 `null`
  - 等级归属：实例快照 level=3 但实时模板表 level=1 → 归到 L1
  - 实时表里没有该模板（已删除）→ 回退快照 level
  - `previousLevels` 反映上期
  - 无日期实例不产生 `activeDays`
- **`src/libs/report/renderMarkdown.test.ts`**：
  - `makeModel` 补 `levels: []` / `previousLevels: []`（类型要求）
  - 「渲染全部小节」：**1~7 节断言原样保留**（这正是选 §8 的意义），新增 `## 8. 按等级`，`## 8. 分析提示词` → `## 9. 分析提示词`
  - 新增用例：等级表渲染（`| L1 | 4 | 3 | 75% | 4 | 3 | 75% |`）、无等级数据时输出 `本期无数据`、英文报告含 `## 8. By level`
  - 现有「所有表格行的列数一致」用例会自动覆盖新表的 7 列
- 现有 `reportService.test.ts:262` 只断言 `formatVersion`，不受影响。

---

## 5. 风险与未定项

1. **改等级会重算历史**（用户已确认）：把任务从 L3 改到 L1 后，过去几周的报表也会跟着把它算进 L1。
   若以后要「历史冻结」，改成读实例快照即可（一处 `resolveInstanceLevel`）。
2. **无日期实例永远不进等级表**：它没有 `instanceDate`，既不算 `planned` 也不进「有任务天数」
   （与现有「无日期任务不计入完成率分母」的口径一致）。若以后想按完成时间归因，是另一个需求。
3. **「跳过」不算清完**：某天该等级的任务全被跳过 → 不计入全清天数。这是严格口径，
   与「存活率」的字面含义一致（今天没真的做完 L1）。若你觉得跳过也该算「处理完了」，改一个比较符即可。
4. **已配置等级即使本期无任务也出现在表里**（`planned=0`、比率 `—`）：好处是周/月/年报表的等级行数稳定、
   可直接对比；代价是新建了 L4 但整期没用过时，报告里会多一行空数据。
5. **UI 与 Markdown 的小节顺序不同**（UI 紧跟任务明细，Markdown 是 §8）：为的是不动知识库引用，见 §0。
6. **知识库待同步（本轮范围外，但会过期）**：
   - `pages/exp1.md:34` 那段「**待建：`level` 字段** … 算不出 L1 存活率」现在已经过期 ——
     字段已上线、报告也按 level 聚合了，这段应改成「已建，见报告第 8 节」。
   - `pages/ai辅助-年报模板.md:9` 的「`level` 功能**待建**；上线前这一节写「本期无 exp1 level 数据」」
     同理，应改成「数据源 = 报告第 8 节按等级表的 L1 存活率」。
   - `pages/exp1.md:23` 的报告节次表可加一行 `|8. 按等级|计划/完成/完成率/有任务天数/全清天数/存活率|`。
   - 这三处改的是 Logseq 知识库（另一个仓库），需要你点头我再动。

---

## 6. 完成后记（2026-09-18）

已按上述方案实现并验证：

- `bunx tsc --noEmit` 干净 · `bunx vitest run` **23 文件 / 255 用例全绿**（原 246，+9）· `bun run build` 成功。
- 代码改动：`libs/task.ts`（导出 `isValidLevel`，排序与报表共用同一判据）、`libs/report/{types,aggregate,renderMarkdown,prompt}.ts`、
  `pages/Reports/{lib.ts,index.tsx,components/{LevelTable.tsx,TemplateTable.tsx}}`、`locales/{zh,en}.json`、
  两个测试文件（`aggregate.test.ts` 新增 7 例、`renderMarkdown.test.ts` 新增 2 例并改节号断言）。
- `formatRate` / `rateClass` 从 `TemplateTable` 抽到 `Reports/lib.ts`，两个表共用（不再是两份配色阈值）。

**与计划的一处修正**：计划里写「无日期实例计入完成率但不进天数」是**错的** ——
`periodInstances` 本身就是 `isDateInPeriod(instance.instanceDate)` 过滤出来的，无日期实例（`instanceDate` 为空）
根本不进等级分桶。测试已改成断言这个真实行为（`L4.planned === 1`，无日期那条被排除），
口径说明与计划的风险 2 一致。

**真浏览器实测（bow + 运行中的 vite dev server，新开标签并显式传 tabId）**

1. 建三条任务 `遛狗 L1 / 健身 L2 / 工作 L3`（当天各一条实例），完成前两个 → 报告页「按等级」表：
   `L1 1/1 100% · L2 1/1 100% · L3 1/0 0%`，有任务天数全 1、全清天数 1/1/0、存活率 100%/100%/0%。
2. 把「工作」改成 L1（DB 里模板 level=1，实例快照仍是 3）→ 报告重新分桶：
   `L1 planned=2 completed=1 50% cleared=0 survival=0`，**L3 整行消失**（已无 3 级模板），
   UI 与模型完全一致 → 证实「按当前模板等级」生效。
3. 在页面里 import `reportService` + `renderMarkdown` 直接生成 Markdown：标题为
   `## 1. 总览指标 … ## 7. 其他 ## 8. 按等级 ## 9. 分析提示词` —— **1~7 节标题与编号与改前逐字一致**，
   知识库里「报告第 4 / 6 / 7 节」的引用不受影响；§8 是 7 列等级表；口径说明第 7 条与提示词第 5 条都在。
4. JSON 里 `levels` 与 `previousLevels` 都在（上期同为 L1/L2/L3，planned 均为 0）。

验证用的三条任务与实例已清掉，dev 库回到 0 任务 + 原有那条 10 分记录；验证用的标签页已关闭（没动用户自己开的标签）。

**仍未做**：知识库那三处「`level` 待建」的过期描述（需你点头才改另一个仓库）。
