import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

export interface SelectFileOptions {
  /** 接受的文件类型，如 ".json" */
  accept?: string;
  /** 是否允许多选 */
  multiple?: boolean;
}

export interface FileData {
  /** 文件名 */
  name: string;
  /** 文件内容（文本） */
  content: string;
}

export interface SaveFileData {
  /** 要保存的内容 */
  content: string;
  /** 建议的文件名 */
  filename: string;
  /** MIME 类型 */
  mimeType?: string;
}

/**
 * 检测是否在 Tauri 环境中运行
 */
function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.__TAURI__ !== undefined ||
      window.__TAURI_INTERNALS__ !== undefined)
  );
}

/**
 * 浏览器环境：选择文件
 */
function browserSelectFile(options: SelectFileOptions): Promise<FileData | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = options.accept || "*";
    input.multiple = options.multiple || false;

    input.onchange = async (event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];

      if (!file) {
        resolve(null);
        return;
      }

      try {
        const content = await file.text();
        resolve({
          name: file.name,
          content,
        });
      } catch (error) {
        console.error("读取文件失败:", error);
        resolve(null);
      }
    };

    input.oncancel = () => {
      resolve(null);
    };

    // 处理用户取消选择的情况
    const handleWindowFocus = () => {
      setTimeout(() => {
        window.removeEventListener("focus", handleWindowFocus);
        // 如果 input 没有被处理，说明用户取消了
        if (!input.files?.length) {
          resolve(null);
        }
      }, 300);
    };

    window.addEventListener("focus", handleWindowFocus);
    input.click();
  });
}

/**
 * 浏览器环境：保存文件
 */
function browserSaveFile(data: SaveFileData): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const blob = new Blob([data.content], {
        type: data.mimeType || "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.style.display = "none";

      document.body.appendChild(a);
      a.click();

      // 清理
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        resolve(true);
      }, 100);
    } catch (error) {
      console.error("保存文件失败:", error);
      resolve(false);
    }
  });
}

/**
 * Tauri 环境：选择文件
 */
async function tauriSelectFile(
  options: SelectFileOptions
): Promise<FileData | null> {
  try {
    const extensions = options.accept
      ? options.accept.replace(".", "").split(",")
      : undefined;

    const selected = await open({
      multiple: options.multiple || false,
      directory: false,
      filters: extensions
        ? [
            {
              name: "Files",
              extensions,
            },
          ]
        : undefined,
    });

    if (!selected || Array.isArray(selected)) {
      return null;
    }

    const content = await readTextFile(selected);
    const fileName = selected.split("/").pop() || selected.split("\\").pop() || "unknown";

    return {
      name: fileName,
      content,
    };
  } catch (error) {
    console.error("Tauri 选择文件失败:", error);
    return null;
  }
}

/**
 * Tauri 环境：保存文件
 */
async function tauriSaveFile(data: SaveFileData): Promise<boolean> {
  try {
    const filePath = await save({
      defaultPath: data.filename,
      filters: data.mimeType?.includes("json")
        ? [
            {
              name: "JSON",
              extensions: ["json"],
            },
          ]
        : undefined,
    });

    if (!filePath) {
      return false;
    }

    await writeTextFile(filePath, data.content);
    return true;
  } catch (error) {
    console.error("Tauri 保存文件失败:", error);
    return false;
  }
}

/**
 * 文件系统兼容库
 *
 * 根据运行环境自动选择合适的实现：
 * - Tauri 环境（PC/Android）：使用 Tauri 的 dialog 和 fs 插件
 * - 浏览器环境：使用 Web File API
 */
export const fileSystem = {
  /**
   * 选择文件
   * @param options 选择选项
   * @returns 文件数据或 null（用户取消）
   */
  async selectFile(options: SelectFileOptions = {}): Promise<FileData | null> {
    if (isTauri()) {
      return tauriSelectFile(options);
    }
    return browserSelectFile(options);
  },

  /**
   * 保存文件
   * @param data 保存的文件数据
   * @returns 是否成功
   */
  async saveFile(data: SaveFileData): Promise<boolean> {
    if (isTauri()) {
      return tauriSaveFile(data);
    }
    return browserSaveFile(data);
  },
};

// 为 TypeScript 声明全局 window 属性
declare global {
  interface Window {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  }
}
