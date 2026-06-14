import { load } from "@tauri-apps/plugin-store";
import type { AppData } from "./types";

const STORE_FILE = "daiban-data.json";
const DATA_KEY = "app-data";

const EMPTY_DATA: AppData = {
  tasks: {},
  notes: [],
};

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export async function loadAppData(): Promise<AppData> {
  try {
    if (isTauriRuntime()) {
      const store = await load(STORE_FILE, { autoSave: false, defaults: {} });
      const value = await store.get<AppData>(DATA_KEY);
      return value ?? EMPTY_DATA;
    }

    const raw = localStorage.getItem(DATA_KEY);
    return raw ? (JSON.parse(raw) as AppData) : EMPTY_DATA;
  } catch (error) {
    console.error("读取本地数据失败：", error);
    return EMPTY_DATA;
  }
}

export async function saveAppData(data: AppData): Promise<void> {
  try {
    if (isTauriRuntime()) {
      const store = await load(STORE_FILE, { autoSave: false, defaults: {} });
      await store.set(DATA_KEY, data);
      await store.save();
      return;
    }

    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("保存本地数据失败：", error);
    throw error;
  }
}
