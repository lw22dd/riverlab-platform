/**
 * 跨层共享的基础类型。
 *
 * `Primitive` 约束场景 DSL 中可直接序列化的字面量；`Tone` 统一 UI 与舞台的
 * 语义色，避免各层自行定义色彩枚举。
 */

export type Primitive = string | number | boolean

export type Tone = 'neutral' | 'info' | 'positive' | 'caution' | 'danger'
