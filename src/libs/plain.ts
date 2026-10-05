/**
 * 把 Vue 的响应式代理深拷贝成普通对象。
 *
 * 为什么需要：ref/reactive 里的对象是 Proxy，Dexie 写库走 structured-clone，
 * 遇到 Proxy 会抛 `DataCloneError: could not be cloned`。
 * 凡是「把表单状态直接写库」的地方都要先过一道这里。
 */
export function toPlain<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}
