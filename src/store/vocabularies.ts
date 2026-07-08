import { create } from "zustand";
import { tenantApi } from "@/api/client";
import type { DisposalMethod, InputTypeDef, EmissionScopeDef } from "@/types";

/**
 * Vocabularies store — platform-managed lookup tables (disposal methods,
 * input types, emission scopes). Replaces hardcoded arrays/enums scattered
 * across ESGInputPage, ReportsPage, etc. Loaded once per session by
 * TenantLayout, mirroring useModulesStore.
 */
interface VocabulariesState {
  disposalMethods: DisposalMethod[];
  inputTypes:      InputTypeDef[];
  emissionScopes:  EmissionScopeDef[];
  loaded: boolean;
  fetchAll: () => Promise<void>;
  getDisposalLabel: (key: string) => string;
  getScopeColor:    (scopeNum: number) => string;
  getScopeLabel:    (scopeNum: number) => string;
}

export const useVocabulariesStore = create<VocabulariesState>((set, get) => ({
  disposalMethods: [],
  inputTypes:      [],
  emissionScopes:  [],
  loaded: false,

  fetchAll: async () => {
    try {
      const [d, i, s] = await Promise.all([
        tenantApi.listDisposalMethods(),
        tenantApi.listInputTypes(),
        tenantApi.listEmissionScopes(),
      ]);
      set({
        disposalMethods: d.data || [],
        inputTypes:      i.data || [],
        emissionScopes:  s.data || [],
        loaded: true,
      });
    } catch {
      set({ loaded: true });
    }
  },

  getDisposalLabel: (key) =>
    get().disposalMethods.find((m) => m.key === key)?.label ?? key,

  getScopeColor: (n) =>
    get().emissionScopes.find((s) => s.scope_number === n)?.color ?? "#64748b",

  getScopeLabel: (n) =>
    get().emissionScopes.find((s) => s.scope_number === n)?.label ?? `Scope ${n}`,
}));
