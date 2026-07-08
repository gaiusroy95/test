import { create } from "zustand";
import { tenantApi } from "@/api/client";
import type { AppFeature } from "@/types";

interface FeaturesState {
  features: AppFeature[];
  loaded: boolean;
  fetchFeatures: () => Promise<void>;
  getByKey: (key: string) => AppFeature | undefined;
  hasFeature: (key: string) => boolean;
}

export const useFeaturesStore = create<FeaturesState>((set, get) => ({
  features: [],
  loaded: false,

  fetchFeatures: async () => {
    try {
      const { data } = await tenantApi.listCompanyFeatures();
      set({ features: data || [], loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  getByKey: (key) => get().features.find((f) => f.key === key),
  hasFeature: (key) => get().features.some((f) => f.key === key && f.is_active),
}));
