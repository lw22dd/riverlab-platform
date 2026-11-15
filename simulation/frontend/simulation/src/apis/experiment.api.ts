import { experimentThemes } from '@/data/experimentThemes'
import type { ExperimentTheme } from '@/models/experiment.model'

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * 实验主题目录。
 *
 * 现阶段以 `data/experimentThemes.ts` 为唯一事实来源，后端只负责会话与汇总。
 * 保留异步签名，后续若改为后端下发，视图层无需改动。
 */
export async function fetchExperimentThemes(): Promise<ExperimentTheme[]> {
  // 保留极短的异步间隔，让加载骨架与将来接口接入后的行为保持一致。
  await wait(120)
  return experimentThemes
}
