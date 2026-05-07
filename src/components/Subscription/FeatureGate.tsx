import React, { useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import UpgradePrompt from './UpgradePrompt';
import { AnimatePresence, motion } from 'motion/react';
import { Lock } from 'lucide-react';
import { SubscriptionPlan } from '../../types';

interface FeatureGateProps {
  featureKey: string;
  featureName: string;
  requiredPlan?: SubscriptionPlan;
  children: React.ReactNode;
  fallback?: 'hide' | 'lock' | 'modal';
}

export default function FeatureGate({ 
  featureKey, 
  featureName, 
  requiredPlan = 'lite', 
  children, 
  fallback = 'lock' 
}: FeatureGateProps) {
  const { hasFeature } = usePermissions();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const isEnabled = hasFeature(featureKey);

  if (isEnabled) {
    return <>{children}</>;
  }

  if (fallback === 'hide') {
    return null;
  }

  if (fallback === 'lock') {
    return (
      <div className="relative group">
        <div className="opacity-40 pointer-events-none filter blur-[1px]">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-white/10 backdrop-blur-[1px] rounded-lg border border-dashed border-gray-200 group-hover:bg-white/20 transition-all">
          <button 
            onClick={() => setShowUpgradeModal(true)}
            className="bg-white/90 shadow-xl border border-gray-100 p-2 rounded-lg flex items-center gap-2 text-xs font-medium text-indigo-600 hover:scale-105 transition-all"
          >
            <Lock className="w-3 h-3" />
            UPGRADE UNTUK AKSES
          </button>
        </div>

        <AnimatePresence>
          {showUpgradeModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <UpgradePrompt 
                  featureName={featureName} 
                  requiredPlan={requiredPlan} 
                  onClose={() => setShowUpgradeModal(false)} 
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <>
      <div onClick={() => setShowUpgradeModal(true)} className="cursor-pointer">
        {children}
      </div>
      <AnimatePresence>
        {showUpgradeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <UpgradePrompt 
                featureName={featureName} 
                requiredPlan={requiredPlan} 
                onClose={() => setShowUpgradeModal(false)} 
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
