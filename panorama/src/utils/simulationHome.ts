/**
 * 仿真主平台（MORAL / LAB）的入口地址。
 *
 * 生产环境里全景挂在 /panorama/ 下、与仿真同源，因此默认用根路径 `/`；
 * 本地只启动全景 Vite（默认 5173）时，dev 默认退回到仿真开发服务器
 * （http://localhost:5174/），也可以用 VITE_SIMULATION_HOME 显式指定，
 * 避免点“返回”回到全景自己。
 */
const ENV_HOME = (import.meta.env.VITE_SIMULATION_HOME as string | undefined)?.trim()

export const SIMULATION_HOME_URL: string =
  ENV_HOME || (import.meta.env.DEV ? 'http://localhost:5174/' : '/')

/** 离开全景系统，回到仿真实验平台首页。 */
export function openSimulationHome(): void {
  window.location.assign(SIMULATION_HOME_URL)
}
