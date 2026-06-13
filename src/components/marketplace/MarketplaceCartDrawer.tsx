import React, { useState } from 'react';
import { ShoppingCart, X, Trash2, Plus, Minus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { Tenant } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import AuthPopup from '../auth/AuthPopup';

interface MarketplaceCartDrawerProps {
  tenant: Tenant | null;
}

export default function MarketplaceCartDrawer({ tenant }: MarketplaceCartDrawerProps) {
  const { cart, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart, totalItems, cartTotal } = useCart();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [showAuthPopup, setShowAuthPopup] = useState(false);

  const handleCheckoutClick = () => {
    if (!user || user.isAnonymous) {
      setShowAuthPopup(true);
    } else {
      setIsCartOpen(false);
      navigate(`/marketplace/${tenant?.slug}/checkout`);
    }
  };

  if (!isCartOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-[100] transition-opacity" 
        onClick={() => setIsCartOpen(false)}
      />
      <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-white z-[101] shadow-2xl flex flex-col transform transition-transform duration-300">
        <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between bg-white">
          <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900">
            <ShoppingCart className="w-5 h-5 text-indigo-600" /> 
            Keranjang ({totalItems})
          </h2>
          <button 
            onClick={() => setIsCartOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/50">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
              <ShoppingCart className="w-16 h-16 opacity-20" />
              <p className="font-medium text-gray-500">Keranjang masih kosong</p>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="mt-2 text-indigo-600 font-semibold hover:text-indigo-700"
              >
                Mulai Belanja
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-3">
                  <div className="flex gap-3">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                      {item.product.image || item.product.imageUrl ? (
                        <img src={item.product.image || item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingCart className="w-6 h-6 text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 text-sm line-clamp-2 leading-snug">{item.product.name}</h4>
                      <p className="text-indigo-600 font-bold mt-1 text-sm">Rp {item.product.price.toLocaleString('id-ID')}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                    <button 
                      onClick={() => removeFromCart(item.id)}
                      className="text-red-500 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-1 border border-gray-200">
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-7 h-7 flex items-center justify-center bg-white border border-gray-200 rounded text-gray-600 hover:bg-gray-100 shadow-sm"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-semibold text-sm w-4 text-center">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center bg-white border border-gray-200 rounded text-gray-600 hover:bg-gray-100 shadow-sm"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="bg-white border-t border-gray-100 p-4 sm:p-6 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-500 font-medium">Total Harga</span>
              <span className="text-xl font-bold text-gray-900">Rp {cartTotal.toLocaleString('id-ID')}</span>
            </div>
            
            <button 
              onClick={handleCheckoutClick}
              className="w-full bg-indigo-600 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              Checkout Sekarang
            </button>
          </div>
        )}
      </div>

      <AuthPopup 
        isOpen={showAuthPopup} 
        onClose={() => setShowAuthPopup(false)} 
        tenant={tenant}
        onSuccess={() => {
          setShowAuthPopup(false);
          setIsCartOpen(false);
          navigate(`/marketplace/${tenant?.slug}/checkout`);
        }}
      />
    </>
  );
}
