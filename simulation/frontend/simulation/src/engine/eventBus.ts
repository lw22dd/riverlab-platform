type Listener<T> = (payload: T) => void

/**
 * 极简的类型化事件总线。
 *
 * 领域解释器不直接引用 Vue 或 Three.js，表现层通过订阅这些事件完成解耦。
 */
export class TypedEventBus<Events extends object> {
  private listeners = new Map<keyof Events, Set<Listener<never>>>()

  /** 订阅事件，返回取消订阅函数，便于组件卸载时精确清理。 */
  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    const bucket = this.listeners.get(event) ?? new Set()
    bucket.add(listener as Listener<never>)
    this.listeners.set(event, bucket)
    return () => {
      bucket.delete(listener as Listener<never>)
    }
  }

  /** 同步广播事件；监听器应自行捕获异常，否则会中断本次分发。 */
  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    // 逐个通知监听器；回调中取消订阅不会影响本次遍历。
    for (const listener of this.listeners.get(event) ?? []) {
      ;(listener as Listener<Events[K]>)(payload)
    }
  }

  /** 清空全部订阅，重开推演时防止旧监听器残留。 */
  clear(): void {
    this.listeners.clear()
  }
}
