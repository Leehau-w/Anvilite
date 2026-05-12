# Phase 1 — 测试基建（Vitest + 引擎测试）

> **前置**：先阅读 `OVERVIEW.md` 了解架构规范和编码约定

---

## 一、Vitest 配置

### 安装

```bash
npm install -D vitest
```

### 配置

在 `vite.config.ts` 中添加（或新建 `vitest.config.ts`）：

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite'

export default defineConfig({
  // ...existing vite config
  test: {
    globals: true,
    environment: 'node',  // 引擎层是纯函数，不需要 DOM
    include: ['src/**/*.test.ts'],
  }
})
```

### package.json scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

### 运行

```bash
npm test              # 单次运行
npm run test:watch    # 监听模式
```

---

## 二、引擎测试规格

### 文件结构

```
src/engines/
  ├── xpEngine.ts
  ├── xpEngine.test.ts          ← 新建
  ├── levelEngine.ts
  ├── levelEngine.test.ts       ← 新建
  ├── prosperityEngine.ts
  ├── prosperityEngine.test.ts  ← 新建
  ├── badgeEngine.ts
  ├── badgeEngine.test.ts       ← 新建
  ├── habitEngine.ts
  └── habitEngine.test.ts       ← 新建
```

---

## 2.1 xpEngine.test.ts

测试 XP 和矿石计算的核心函数。先阅读 `xpEngine.ts` 确认实际导出的函数名和签名，以下为预期的测试结构：

```typescript
import { describe, it, expect } from 'vitest'
// import 实际导出的函数

describe('xpEngine', () => {
  
  describe('基础 XP 计算', () => {
    it('难度 1 → 基础 XP = 1', () => { /* ... */ })
    it('难度 2 → 基础 XP = 2', () => { /* ... */ })
    it('难度 3 → 基础 XP = 3', () => { /* ... */ })
    it('难度 4 → 基础 XP = 5', () => { /* ... */ })
    it('难度 5 → 基础 XP = 8', () => { /* ... */ })
  })

  describe('连续活跃加成', () => {
    // 当前 v0.1 公式（阶梯式）：
    // 0-2天 → 0%, 3天 → +10%, 7天 → +20%, 14天 → +30%, 30天 → +50%
    it('0 天连续 → 无加成', () => { /* ... */ })
    it('2 天连续 → 无加成', () => { /* ... */ })
    it('3 天连续 → +10%', () => { /* ... */ })
    it('7 天连续 → +20%', () => { /* ... */ })
    it('14 天连续 → +30%', () => { /* ... */ })
    it('30 天连续 → +50%', () => { /* ... */ })
    it('100 天连续 → +50%（上限）', () => { /* ... */ })
  })

  describe('按时完成加成', () => {
    it('按时完成 → ×1.2', () => { /* ... */ })
    it('未按时完成 → ×1.0', () => { /* ... */ })
    it('无截止日期 → 视为按时', () => { /* ... */ })
  })

  describe('高难度加成', () => {
    it('难度 4 → ×1.5', () => { /* ... */ })
    it('难度 5 → ×1.5', () => { /* ... */ })
    it('难度 3 → ×1.0', () => { /* ... */ })
  })

  describe('综合计算', () => {
    it('难度5 + 7天连续 + 按时 = round(8 × 1.2 × 1.2 × 1.5)', () => { /* ... */ })
    it('难度1 + 0天连续 + 未按时 = 1', () => { /* ... */ })
    it('矿石 = XP（1:1）', () => { /* ... */ })
  })

  describe('子任务', () => {
    it('子任务不计算 XP（返回 0）', () => { /* ... */ })
  })
})
```

**重要**：先读源代码确认实际函数签名，再写测试。不要假设函数名。

---

## 2.2 levelEngine.test.ts

```typescript
describe('levelEngine', () => {
  
  describe('升级阈值', () => {
    // 公式：round(5 × ln(level + 1) × level)
    it('Lv.1 → 需要 5 XP 升级', () => { /* ... */ })
    it('Lv.5 → 需要约 16 XP 升级', () => { /* ... */ })
    it('Lv.10 → 需要约 30 XP 升级', () => { /* ... */ })
    it('Lv.20 → 需要约 60 XP 升级', () => { /* ... */ })
    it('Lv.50 → 需要约 147 XP 升级', () => { /* ... */ })
  })

  describe('等级计算（从 total_xp 推算等级）', () => {
    it('0 XP → Lv.1', () => { /* ... */ })
    it('5 XP → Lv.2', () => { /* ... */ })
    it('刚好够升级 → 升级', () => { /* ... */ })
    it('差 1 XP → 不升级', () => { /* ... */ })
  })

  describe('称号映射', () => {
    // 锻造系阶梯：[1, 6, 11, 16, 21, 31, 41, 51]
    it('Lv.1 → 破壳/新手', () => { /* ... */ })
    it('Lv.6 → 熔炼/学徒', () => { /* ... */ })
    it('Lv.51 → 不朽/传说', () => { /* ... */ })
    it('锻造系和RPG系均正确', () => { /* ... */ })
  })

  describe('Prestige', () => {
    it('Lv.51 可重铸', () => { /* ... */ })
    it('Lv.50 不可重铸', () => { /* ... */ })
    it('重铸后等级归 1', () => { /* ... */ })
  })
})
```

---

## 2.3 prosperityEngine.test.ts

```typescript
describe('prosperityEngine', () => {

  describe('技能 XP → 技能等级', () => {
    // 对数增长
    it('0 XP → 技能等级 0', () => { /* ... */ })
    it('边界值测试', () => { /* ... */ })
  })

  describe('技能等级 → 繁荣等级', () => {
    // 0→荒芜(1), 1-3→聚落(2), 4-8→丰饶(3),
    // 9-15→繁荣(4), 16-25→鼎盛(5), 26+→辉煌(6)
    it('技能等级 0 → 荒芜 (1)', () => { /* ... */ })
    it('技能等级 1 → 聚落 (2)', () => { /* ... */ })
    it('技能等级 3 → 聚落 (2)', () => { /* ... */ })
    it('技能等级 4 → 丰饶 (3)', () => { /* ... */ })
    it('技能等级 8 → 丰饶 (3)', () => { /* ... */ })
    it('技能等级 9 → 繁荣 (4)', () => { /* ... */ })
    it('技能等级 15 → 繁荣 (4)', () => { /* ... */ })
    it('技能等级 16 → 鼎盛 (5)', () => { /* ... */ })
    it('技能等级 25 → 鼎盛 (5)', () => { /* ... */ })
    it('技能等级 26 → 辉煌 (6)', () => { /* ... */ })
    it('技能等级 100 → 辉煌 (6)', () => { /* ... */ })
  })
})
```

---

## 2.4 badgeEngine.test.ts

```typescript
describe('badgeEngine', () => {

  describe('徽章解锁检测', () => {
    // 先读 src/types/badge.ts 确认 31 枚徽章的 ID 和条件
    // 按类别分组测试

    describe('起步类', () => {
      it('完成第一个任务 → 解锁起步徽章', () => { /* ... */ })
    })

    describe('等级类', () => {
      it('达到 Lv.10 → 解锁对应徽章', () => { /* ... */ })
      it('未达到 → 不解锁', () => { /* ... */ })
    })

    describe('坚持类（活跃天数）', () => {
      it('连续 7 天 → 解锁', () => { /* ... */ })
      it('连续 30 天 → 解锁', () => { /* ... */ })
    })

    describe('习惯类（单习惯连续）', () => {
      it('单习惯连续 14 次 → 解锁', () => { /* ... */ })
    })

    describe('收集类（主题）', () => {
      it('解锁 N 个主题 → 解锁', () => { /* ... */ })
    })

    describe('已获得徽章不重复', () => {
      it('已有的徽章不在返回列表中', () => { /* ... */ })
    })
  })
})
```

**注意**：先读 `src/types/badge.ts` 和 `src/engines/badgeEngine.ts` 确认实际的徽章 ID、条件结构和函数签名，再补充具体测试用例和断言值。

---

## 2.5 habitEngine.test.ts

```typescript
describe('habitEngine', () => {

  describe('isHabitDueToday — 8 种重复模式', () => {
    
    // 为每种模式构造 mock habit + mock 日期

    it('每天 → 任何日期都 due', () => { /* ... */ })
    
    it('工作日 → 周一至周五 due，周六日不 due', () => { /* ... */ })
    
    it('每周（严格）→ 指定周几 due', () => {
      // weeklyDays: ['mon', 'wed', 'fri']
      // 周一 → true, 周二 → false, 周三 → true
    })
    
    it('每周（弹性）→ 每天都 due（用户自由安排）', () => { /* ... */ })
    
    it('隔周 → 每 14 天一次', () => { /* ... */ })
    
    it('每月 → 每月出现', () => { /* ... */ })
    
    it('每月固定 → 指定日期出现', () => {
      // monthlyDays: [1, 15]
      // 1号 → true, 2号 → false, 15号 → true
    })
    
    it('每月固定月末 → 月末边界处理', () => {
      // monthlyDays: [31]
      // 2月28日（非闰年）→ true（月末兜底）
    })

    it('自定义 → 每 N 天一次', () => {
      // customIntervalDays: 3, startDate: '2026-01-01'
      // 01-01 → true, 01-02 → false, 01-04 → true
    })
  })

  describe('连续计算', () => {
    it('完成 → consecutiveCount + 1', () => { /* ... */ })
    it('跳过 → consecutiveCount × 0.9（下取整）', () => {
      // 10 → 9, 5 → 4, 1 → 0
    })
    it('缺席无容错 → consecutiveCount × 0.5', () => {
      // 10 → 5, 7 → 3
    })
    it('缺席有容错 → 消耗容错充能，consecutiveCount 不变', () => { /* ... */ })
  })

  describe('容错充能', () => {
    it('首次连续 7 次 → 获得 1 次充能', () => { /* ... */ })
    it('之后每 14 次 → 获得 1 次充能', () => { /* ... */ })
    it('充能上限 1 次', () => { /* ... */ })
    it('消耗后重新累积', () => { /* ... */ })
  })

  describe('周弹性习惯', () => {
    it('完成 1 次 → currentCycleCount + 1', () => { /* ... */ })
    it('达到 targetCount → 结算 XP', () => { /* ... */ })
    it('跨周重置 currentCycleCount 为 0', () => { /* ... */ })
  })
})
```

---

## 三、测试编写指南

### 原则

1. **先读源码再写测试**：不要基于文档假设函数签名，打开对应的 engine 文件确认实际导出
2. **测边界值**：0、1、阈值、阈值±1、极大值
3. **测试标题用中文**：方便其他开发者阅读
4. **一个 `it` 只测一个行为**
5. **不要 mock engine 内部**：engine 是纯函数，直接测输入输出

### 模式

```typescript
// 基本模式
it('描述预期行为', () => {
  const result = engineFunction(input)
  expect(result).toBe(expectedOutput)
})

// 边界值
it('最小值', () => { expect(fn(0)).toBe(expected) })
it('最大值', () => { expect(fn(MAX)).toBe(expected) })
it('阈值刚好', () => { expect(fn(THRESHOLD)).toBe(expected) })
it('阈值 - 1', () => { expect(fn(THRESHOLD - 1)).toBe(expected) })

// 日期相关（使用固定日期避免测试不稳定）
it('工作日判定', () => {
  // 2026-04-06 是周一
  const monday = new Date('2026-04-06')
  expect(isHabitDueToday(workdayHabit, monday)).toBe(true)
  
  // 2026-04-04 是周六
  const saturday = new Date('2026-04-04')
  expect(isHabitDueToday(workdayHabit, saturday)).toBe(false)
})
```

### 注意事项

- 日期测试使用固定日期字符串，不用 `new Date()`（避免测试结果随日期变化）
- 如果 engine 函数内部使用了 `new Date()`，考虑是否需要将日期作为参数传入以便测试（如果需要改函数签名，这是可接受的重构）
- 浮点数比较使用 `toBeCloseTo` 而非 `toBe`
