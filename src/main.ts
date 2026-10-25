import { createApp } from "vue";
import { createPinia } from "pinia";
import { isTauri } from "@tauri-apps/api/core";
import { onBackButtonPress } from "@tauri-apps/api/app";
import { setBackButtonAdapter } from "@ruinb0w/ui";
import "@ruinb0w/ui/style.css";
import App from "./App.vue";
import router from "./router";
import "./index.css";

// 主题/密度在挂载前定好，避免首帧闪一下默认主题
document.documentElement.dataset.theme = "exp1-dark";
document.documentElement.dataset.density = "touch";

// 返回手势交给 UI 库的层栈：只占用有浮层时的返回，栈一空立刻注销
if (isTauri()) {
  setBackButtonAdapter((onBack) => {
    let unregister: (() => void) | null = null;
    let cancelled = false;
    onBackButtonPress(onBack)
      .then((registered) => {
        // 极端竞态：await 期间浮层全关了，立刻注销，别把返回手势永久吞掉
        if (cancelled) void registered.unregister();
        else unregister = () => void registered.unregister();
      })
      .catch((error) => {
        console.warn("注册返回手势监听失败", error);
      });
    return () => {
      cancelled = true;
      unregister?.();
    };
  });
}

createApp(App).use(createPinia()).use(router).mount("#root");
