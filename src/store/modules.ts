import { create } from "zustand";
import { tenantApi } from "@/api/client";
import type { AppModule } from "@/types";

interface ModulesState {
  modules: AppModule[];
  loaded: boolean;
  fetchModules: () => Promise<void>;
  getByKey: (key: string) => AppModule | undefined;
  getById: (id: number) => AppModule | undefined;
}

export const useModulesStore = create<ModulesState>((set, get) => ({
  modules: [],
  loaded: false,

  fetchModules: async () => {
    try {
      const { data } = await tenantApi.listCompanyModules();
      set({ modules: data || [], loaded: true });
    } catch {
      // Non-fatal — pages fall back gracefully if modules are empty
      set({ loaded: true });
    }
  },

  getByKey: (key) => get().modules.find((m) => m.key === key),
  getById:  (id)  => get().modules.find((m) => m.module_id === id),
}));
