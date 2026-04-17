import { useAuth } from './useAuth';
import { FEATURE_KEYS, PLANS } from '../constants/plans';

export const usePermissions = () => {
  const { profile, tenant, permissions: customPermissions } = useAuth();

  const isSuperAdmin = profile?.role === 'superadmin';
  const isAdmin = profile?.role === 'admin';

  const hasFeature = (featureKey: string) => {
    if (isSuperAdmin) return true;
    
    // Check if tenant has the feature enabled (either via plan or custom toggle)
    const tenantFeatures = tenant?.features || PLANS[tenant?.plan || tenant?.subscription || 'free']?.features || [];
    const isFeatureEnabledForTenant = tenantFeatures.includes(featureKey);

    if (!isFeatureEnabledForTenant) return false;

    // If it's a custom role, check their specific permissions
    if (profile && !['superadmin', 'admin'].includes(profile.role)) {
      return customPermissions.includes(featureKey);
    }

    return true;
  };

  const checkLimit = (limitKey: keyof NonNullable<typeof tenant>['limits']) => {
    if (isSuperAdmin) return true;
    
    const tenantLimits = tenant?.limits || PLANS[tenant?.plan || tenant?.subscription || 'free']?.limits;
    return tenantLimits?.[limitKey] || 0;
  };

  return {
    hasFeature,
    checkLimit,
    isSuperAdmin,
    isAdmin,
    plan: tenant?.plan || tenant?.subscription || 'free',
    FEATURE_KEYS
  };
};
