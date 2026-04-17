import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth.jsx';
import { getCurrentPlan } from '../services/billingApi.js';
import UpgradeWall from '../components/UpgradeWall.jsx';

const PLAN_RANK = { free: 0, starter: 1, pro: 2, ultra: 3 };

const PlanGateContext = createContext({
  planInfo: null,
  hasPlan: () => true,
  requirePlan: (_plan, cb) => cb && cb(),
  refreshPlan: () => Promise.resolve(),
});

export const usePlanGate = () => useContext(PlanGateContext);

export function PlanGateProvider({ children }) {
  const { workspace, isAuthenticated } = useEcomAuth();
  const workspaceId = workspace?._id || workspace?.id || null;

  const [planInfo, setPlanInfo] = useState(null);
  const [open, setOpen] = useState(false);
  const [requiredPlan, setRequiredPlan] = useState(null);

  const refreshPlan = useCallback(async () => {
    if (!isAuthenticated || !workspaceId) return;
    try {
      const data = await getCurrentPlan(workspaceId);
      setPlanInfo(data);
    } catch {
      /* silent — popup fallback will treat as free */
    }
  }, [isAuthenticated, workspaceId]);

  useEffect(() => {
    refreshPlan();
  }, [refreshPlan]);

  const hasPlan = useCallback((plan) => {
    if (!plan || plan === 'free') return true;
    const current = planInfo?.plan || 'free';
    const isActive = planInfo?.isActive || planInfo?.trial?.active;
    if (!isActive && current !== 'free') return false;
    return (PLAN_RANK[current] ?? 0) >= (PLAN_RANK[plan] ?? 0);
  }, [planInfo]);

  const requirePlan = useCallback((plan, callback) => {
    if (hasPlan(plan)) {
      if (typeof callback === 'function') callback();
      return true;
    }
    setRequiredPlan(plan);
    setOpen(true);
    return false;
  }, [hasPlan]);

  const value = useMemo(() => ({
    planInfo,
    hasPlan,
    requirePlan,
    refreshPlan,
  }), [planInfo, hasPlan, requirePlan, refreshPlan]);

  return (
    <PlanGateContext.Provider value={value}>
      {children}
      {open && (
        <UpgradeWall
          onDismiss={() => { setOpen(false); setRequiredPlan(null); }}
          workspaceId={workspaceId}
          trialUsed={planInfo?.trial?.used}
          selectedPlan={requiredPlan}
        />
      )}
    </PlanGateContext.Provider>
  );
}
