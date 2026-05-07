import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'info' | 'warning';
  showCancel?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  type = 'info',
  showCancel = true
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-[650px] overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className={`p-3 rounded-full mr-4 ${
                  type === 'danger' ? 'bg-red-100 text-red-600' : 
                  type === 'warning' ? 'bg-yellow-100 text-yellow-600' : 'bg-indigo-100 text-indigo-600'
                }`}>
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">{title}</h3>
              </div>
              <p className="text-gray-600 mb-8">{message}</p>
              <div className="flex space-x-3">
                {showCancel && (
                  <button
                    onClick={onCancel}
                    className="flex-1 p-2 border border-gray-200 rounded-lg text-gray-600 font-medium hover:bg-white transition-colors"
                  >
                    {cancelText}
                  </button>
                )}
                <button
                  onClick={onConfirm}
                  className={`${showCancel ? 'flex-1' : 'w-full'} px-4 py-3 rounded-xl text-white font-bold transition-all shadow-lg ${
                    type === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 
                    type === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700 shadow-yellow-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                  }`}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
