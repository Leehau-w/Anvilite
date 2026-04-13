/**
 * 标准化任务/习惯标题，去除序号、日期等变化部分，用于高频行为统计分组。
 */
export function normalizeTitle(title: string): string {
  return title
    .replace(/[#＃]\s*\d+/g, '')                    // #1, ＃2
    .replace(/第\s*\d+\s*[章节篇回]/g, '')            // 第1章, 第3节
    .replace(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/g, '')    // 2026-04-13
    .replace(/\d+/g, '')                             // 其余数字
    .replace(/\s+/g, ' ')                            // 合并多余空格
    .trim()
}
