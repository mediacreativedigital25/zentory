import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, onSnapshot, runTransaction, Timestamp, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Product, Customer, BankAccount, StockLog, Tenant } from '../types';
import { ShoppingCart, Search, Plus, Minus, Trash2, CreditCard, User, Tag, Briefcase, X, ListOrdered, Barcode, Landmark, AlertCircle, CheckCircle2, Printer, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';
import { logStockChange } from '../lib/stock-logger';
import { getDoc } from 'firebase/firestore';

export default function SalesOrder() {
  const { profile, domainTenantId } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'cash' | 'credit'>('cash');
  const [paymentMethodType, setPaymentMethodType] = useState<'tunai' | 'transfer'>('tunai');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [orderType, setOrderType] = useState<'manual' | 'service'>('manual');
  const [search, setSearch] = useState('');
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState('');
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [printType, setPrintType] = useState<'invoice' | 'receipt' | null>(null);
  const [tenantInfo, setTenantInfo] = useState<Tenant | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  const [isSettledToday, setIsSettledToday] = useState(false);

  useEffect(() => {
    const targetTenantId = domainTenantId || profile?.tenantId;
    if (targetTenantId) {
      getDoc(doc(db, 'tenants', targetTenantId)).then(snap => {
        if (snap.exists()) {
          setTenantInfo({ id: snap.id, ...snap.data() } as Tenant);
        }
      });
    }
  }, [profile, domainTenantId]);

  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintType(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  useEffect(() => {
    if (!profile) return;
    const targetTenantId = domainTenantId || profile.tenantId;
    if (!targetTenantId && profile.role !== 'superadmin') return;

    const pQuery = (profile.role === 'superadmin' && !domainTenantId)
      ? collection(db, 'products')
      : query(collection(db, 'products'), where('tenantId', '==', targetTenantId));
    
    const cQuery = (profile.role === 'superadmin' && !domainTenantId)
      ? collection(db, 'customers')
      : query(collection(db, 'customers'), where('tenantId', '==', targetTenantId));
    
    const bQuery = (profile.role === 'superadmin' && !domainTenantId)
      ? query(collection(db, 'bank_accounts'), where('isActive', '==', true))
      : query(collection(db, 'bank_accounts'), where('tenantId', '==', targetTenantId), where('isActive', '==', true));

    const unsubProducts = onSnapshot(pQuery, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    }, (error) => {
      console.error('Error fetching products:', error);
    });

    const unsubCustomers = onSnapshot(cQuery, (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    }, (error) => {
      console.error('Error fetching customers:', error);
    });

    const unsubBanks = onSnapshot(bQuery, async (snap) => {
      const banks = snap.docs.map(d => ({ id: d.id, ...d.data() } as BankAccount));
      
      // Check if TUNAI account exists, if not create it
      let tunaiAccount = banks.find(b => b.name.toUpperCase() === 'TUNAI');
      
      if (!tunaiAccount && targetTenantId) {
        try {
          await addDoc(collection(db, 'bank_accounts'), {
            tenantId: targetTenantId,
            name: 'TUNAI',
            accountNumber: 'CASH',
            balance: 0,
            isActive: true,
            createdAt: serverTimestamp()
          });
          // The snapshot will trigger again with the new account
        } catch (err) {
          console.error('Error creating TUNAI account:', err);
        }
      }

      setBankAccounts(banks);
      
      // Auto-select bank account
      if (paymentMethodType === 'tunai' && tunaiAccount) {
        setSelectedBankAccountId(tunaiAccount.id);
      } else if (paymentMethodType === 'transfer' && banks.length > 0) {
        const firstNonTunai = banks.find(b => b.name.toUpperCase() !== 'TUNAI') || banks[0];
        setSelectedBankAccountId(firstNonTunai.id);
      }
    }, (error) => {
      console.error('Error fetching bank accounts:', error);
    });

    if (targetTenantId) {
      // Check if today is settled
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const settledQ = query(
        collection(db, 'dailyClosings'),
        where('tenantId', '==', targetTenantId),
        where('date', '>=', Timestamp.fromDate(startOfDay)),
        where('date', '<=', Timestamp.fromDate(endOfDay)),
        limit(1)
      );

      const unsubSettled = onSnapshot(settledQ, (snap) => {
        setIsSettledToday(!snap.empty);
      }, (error) => {
        console.error('Error fetching settlement status:', error);
      });

      return () => {
        unsubProducts();
        unsubCustomers();
        unsubBanks();
        unsubSettled();
      };
    }

    return () => {
      unsubProducts();
      unsubCustomers();
      unsubBanks();
    };
  }, [profile, domainTenantId]);

  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, []);

  const handleBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeSearch.trim()) return;

    const product = products.find(p => p.barcode === barcodeSearch.trim() || p.sku === barcodeSearch.trim());
    if (product) {
      addToCart(product);
      setBarcodeSearch('');
    } else {
      // Optional: Add a sound or visual feedback for not found
      console.log('Product not found for barcode:', barcodeSearch);
      setBarcodeSearch('');
    }
  };

  const [selectedVariantProduct, setSelectedVariantProduct] = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');

  const addToCart = (product: Product, variantId?: string) => {
    const isService = product.type === 'service';
    
    if (product.variants && product.variants.length > 0 && !variantId) {
      setSelectedVariantProduct(product);
      setSelectedVariantId(product.variants[0].id);
      return;
    }

    const variant = variantId ? product.variants?.find((v: any) => v.id === variantId) : null;
    const stockToUse = variant ? variant.stock : product.stock;

    if (orderType === 'manual' && !isService && stockToUse <= 0) {
      alert('Stok produk/variasi ini habis!');
      return;
    }

    const cartItemId = variantId ? `${product.id}-${variantId}` : product.id;
    const existing = cart.find(item => {
        const itemVid = (item as any).variantId;
        const currentItemId = itemVid ? `${item.product.id}-${itemVid}` : item.product.id;
        return currentItemId === cartItemId;
    });

    if (existing) {
      if (orderType === 'manual' && !isService && existing.quantity >= stockToUse) return;
      setCart(cart.map(item => {
          const itemVid = (item as any).variantId;
          const currentItemId = itemVid ? `${item.product.id}-${itemVid}` : item.product.id;
          return currentItemId === cartItemId ? { ...item, quantity: item.quantity + 1 } : item;
      }));
    } else {
      setCart([...cart, { product, quantity: 1, variantId } as any]);
    }

    setSelectedVariantProduct(null);
    setSelectedVariantId('');
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setCart(cart.map(item => {
      const itemVid = (item as any).variantId;
      const currentItemId = itemVid ? `${item.product.id}-${itemVid}` : item.product.id;

      if (currentItemId === cartItemId) {
        const newQty = Math.max(0, item.quantity + delta);
        const isService = item.product.type === 'service';
        
        const variant = itemVid ? item.product.variants?.find((v: any) => v.id === itemVid) : null;
        const stockToUse = variant ? variant.stock : item.product.stock;

        if (orderType === 'manual' && !isService && newQty > stockToUse) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const setQuantity = (cartItemId: string, value: number) => {
    setCart(cart.map(item => {
      const itemVid = (item as any).variantId;
      const currentItemId = itemVid ? `${item.product.id}-${itemVid}` : item.product.id;

      if (currentItemId === cartItemId) {
        const newQty = Math.max(0, value);
        const isService = item.product.type === 'service';

        const variant = itemVid ? item.product.variants?.find((v: any) => v.id === itemVid) : null;
        const stockToUse = variant ? variant.stock : item.product.stock;

        if (orderType === 'manual' && !isService && newQty > stockToUse) {
          return { ...item, quantity: stockToUse };
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const getProductPrice = (product: Product, variantId?: string) => {
    // Calculate total quantity of this product in cart (across all variants)
    const productTotalQty = cart
      .filter(item => item.product.id === product.id)
      .reduce((sum, item) => sum + item.quantity, 0);

    let basePrice = product.price;

    if (variantId && product.variants) {
        const variant = product.variants.find((v: any) => v.id === variantId);
        if (variant) basePrice = variant.price;
    }

    if (!product.wholesalePrices || product.wholesalePrices.length === 0) {
      return basePrice;
    }
    
    // Sort by minQuantity descending to find the highest applicable tier
    const applicableTier = [...product.wholesalePrices]
      .sort((a, b) => b.minQuantity - a.minQuantity)
      .find(tier => productTotalQty >= tier.minQuantity);
      
    return applicableTier ? applicableTier.price : basePrice;
  };

  const total = cart.reduce((acc, item) => acc + (getProductPrice(item.product, (item as any).variantId) * item.quantity), 0);

  useEffect(() => {
    if (paymentType === 'cash') {
      setAmountPaid(total);
      if (cashReceived < total) {
        setCashReceived(total);
      }
    }
  }, [total, paymentType]);

  useEffect(() => {
    if (paymentMethodType === 'tunai') {
      const tunaiAccount = bankAccounts.find(b => b.name.toUpperCase() === 'TUNAI');
      if (tunaiAccount) setSelectedBankAccountId(tunaiAccount.id);
    }
  }, [paymentMethodType, bankAccounts]);

  const change = cashReceived - total;

  const generateOrderNumber = async (type: 'manual' | 'catalog' | 'service') => {
    const now = new Date();
    const yearMonth = now.getFullYear().toString() + (now.getMonth() + 1).toString().padStart(2, '0');
    const prefix = type === 'manual' ? 'M' : type === 'catalog' ? 'IN' : '0J';
    const targetTenantId = domainTenantId || profile?.tenantId;
    
    // In a real app, you'd use a counter in Firestore to ensure uniqueness
    // For this demo, we'll use a random suffix or count existing orders
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where('tenantId', '==', targetTenantId), where('type', '==', type));
    const snap = await getDocs(q);
    const sequence = (snap.size + 1).toString().padStart(6, '0');
    
    return `${prefix}${yearMonth}${sequence}`;
  };

  const currentCustomer = customers.find(c => c.id === selectedCustomer);
  const canUseTempo = currentCustomer?.type === 'langganan' && currentCustomer?.allowTempo;

  const handleCheckout = async () => {
    if (cart.length === 0 || isProcessing) return;

    if (isSettledToday) {
      alert('Buku hari ini sudah ditutup (Settled). Tidak dapat memproses pesanan baru.');
      return;
    }

    setConfirmConfig({
      isOpen: true,
      title: 'Konfirmasi Pesanan',
      message: 'Apakah Anda yakin ingin memproses pesanan ini?',
      onConfirm: async () => {
        setConfirmConfig(null);
        setIsProcessing(true);
        const targetTenantId = domainTenantId || profile?.tenantId;
        try {
          const isKasir = profile?.role === 'kasir';
          let orderNumber = '';

          if (isKasir) {
            // Generate number PYYYYMM000001
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const prefix = `P${year}${month}`;
            
            try {
              const q = query(
                collection(db, 'orders'),
                where('tenantId', '==', targetTenantId),
                where('orderNumber', '>=', prefix),
                where('orderNumber', '<=', prefix + '\uf8ff'),
                orderBy('orderNumber', 'desc'),
                limit(1)
              );
              
              const snap = await getDocs(q);
              let nextIndex = 1;
              
              if (!snap.empty) {
                const lastNum = snap.docs[0].data().orderNumber;
                const lastIndexStr = lastNum.replace(prefix, '');
                const lastIndex = parseInt(lastIndexStr, 10);
                if (!isNaN(lastIndex)) {
                  nextIndex = lastIndex + 1;
                }
              }
              
              orderNumber = `${prefix}${String(nextIndex).padStart(6, '0')}`;
            } catch (queryErr) {
              orderNumber = `${prefix}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
            }
          } else {
            orderNumber = await generateOrderNumber(orderType);
          }

          const customer = customers.find(c => c.id === selectedCustomer);
          
          const orderRef = doc(collection(db, 'orders'));
          const transactionRef = doc(collection(db, 'transactions'));

          // Calculate Due Date if credit
          let dueDate = null;
          if (paymentType === 'credit' && customer?.allowTempo) {
            const days = customer.tempoLimitDays || 30;
            const date = new Date();
            date.setDate(date.getDate() + days);
            dueDate = Timestamp.fromDate(date);
          }

          // Determine status based on payment
          const status = amountPaid >= total ? 'completed' : amountPaid > 0 ? 'processing' : 'pending';
          const paymentStatus = amountPaid >= total ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid';

          await runTransaction(db, async (transaction) => {
            // 1. Read all necessary data first (Update stock for manual products)
            const productUpdates: { ref: any; updateData: any; item: any; previousStock: number; currentItemStock: number }[] = [];
            
            if (orderType === 'manual') {
              for (const item of cart) {
                const productRef = doc(db, 'products', item.product.id);
                const pDoc = await transaction.get(productRef);
                
                if (!pDoc.exists()) throw new Error(`Product ${item.product.name} not found`);
                
                const productData = pDoc.data() as Product;
                const itemVid = (item as any).variantId;
                const isService = productData.type === 'service';
                
                if (!isService) {
                  let previousStock = productData.stock || 0;
                  let currentItemStock = 0;
                  let updateData: any = {};

                  if (itemVid && productData.variants) {
                    const variantIndex = productData.variants.findIndex(v => v.id === itemVid);
                    if (variantIndex === -1) throw new Error(`Variant not found for ${productData.name}`);
                    
                    const variant = productData.variants[variantIndex];
                    currentItemStock = variant.stock;
                    if (currentItemStock < item.quantity) {
                      throw new Error(`Stok variasi ${variant.name} untuk ${productData.name} tidak mencukupi`);
                    }

                    const updatedVariants = [...productData.variants];
                    updatedVariants[variantIndex] = {
                      ...variant,
                      stock: variant.stock - item.quantity
                    };

                    updateData = {
                      variants: updatedVariants,
                      stock: (productData.stock || 0) - item.quantity
                    };
                  } else {
                    currentItemStock = productData.stock || 0;
                    if (currentItemStock < item.quantity) {
                      throw new Error(`Stok ${productData.name} tidak mencukupi`);
                    }
                    updateData = {
                      stock: (productData.stock || 0) - item.quantity
                    };
                  }

                  productUpdates.push({
                    ref: productRef,
                    updateData,
                    item,
                    previousStock,
                    currentItemStock
                  });
                }
              }
            }

            // 2. Perform all writes after all reads
            for (const update of productUpdates) {
              transaction.update(update.ref, update.updateData);
              
              const itemVid = (update.item as any).variantId;
              const variant = itemVid ? update.item.product.variants?.find((v: any) => v.id === itemVid) : null;
              const logName = variant ? `${update.item.product.name} (${variant.name})` : update.item.product.name;

              logStockChange(
                targetTenantId!,
                update.item.product.id,
                logName,
                'SALE',
                update.item.quantity,
                update.currentItemStock,
                update.currentItemStock - update.item.quantity,
                profile?.uid!,
                profile?.displayName || 'System',
                { id: orderRef.id, number: orderNumber },
                `Sales Order ${itemVid ? '(Variant)' : ''}`
              );
            }

            // Create Order
            transaction.set(orderRef, {
              orderNumber,
              tenantId: targetTenantId,
              customerId: selectedCustomer || null,
              customerName: customer?.name || 'Guest',
              type: isKasir ? 'pos' : orderType,
            items: cart.map(item => {
              const itemVid = (item as any).variantId;
              const variant = itemVid ? item.product.variants?.find((v: any) => v.id === itemVid) : null;
              const unitPrice = getProductPrice(item.product, itemVid);
              const name = variant ? `${item.product.name} (${variant.name})` : item.product.name;
              
              return {
                productId: item.product.id,
                variantId: itemVid || null,
                name,
                quantity: item.quantity,
                price: unitPrice,
                hpp: variant ? (variant.hpp || 0) : (item.product.hpp || 0)
              };
            }),
              totalAmount: total,
              paidAmount: amountPaid,
              paymentStatus,
              paymentType,
              date: serverTimestamp(),
              dueDate,
              status: status,
              userId: profile?.uid,
              paymentMethod: selectedBankAccountId || null,
              createdAt: serverTimestamp()
            });

            // 3. Create Financial Transaction (only if there's an actual payment)
            if (amountPaid > 0) {
              transaction.set(transactionRef, {
                tenantId: targetTenantId,
                type: 'sale',
                category: 'Sales',
                amount: amountPaid, // Only record the actual amount paid
                totalOrderAmount: total,
                items: cart.map(item => {
                  const itemVid = (item as any).variantId;
                  const variant = itemVid ? item.product.variants?.find((v: any) => v.id === itemVid) : null;
                  return {
                    productId: item.product.id,
                    variantId: itemVid || null,
                    name: variant ? `${item.product.name} (${variant.name})` : item.product.name,
                    quantity: item.quantity,
                    price: getProductPrice(item.product, itemVid),
                    hpp: variant ? (variant.hpp || 0) : (item.product.hpp || 0)
                  };
                }),
                date: serverTimestamp(),
                dueDate: paymentType === 'credit' ? dueDate : null,
                status: 'completed',
                userId: profile?.uid,
                orderNumber: orderNumber,
                bankAccountId: selectedBankAccountId || null,
                createdAt: serverTimestamp()
              });
            }
          });

          setLastOrder({
            orderNumber,
            customerName: customer?.name || 'Guest',
            items: cart.map(item => {
              const itemVid = (item as any).variantId;
              const variant = itemVid ? item.product.variants?.find((v: any) => v.id === itemVid) : null;
              return {
                productId: item.product.id,
                name: variant ? `${item.product.name} (${variant.name})` : item.product.name,
                quantity: item.quantity,
                price: getProductPrice(item.product, itemVid)
              };
            }),
            totalAmount: total,
            status: status,
            type: orderType,
            date: { seconds: Date.now() / 1000 }
          });
          setLastOrderNumber(orderNumber);
          setShowSuccessModal(true);
          setIsCheckoutModalOpen(false);
          setCart([]);
          setSelectedCustomer('');
          setAmountPaid(0);
          setCashReceived(0);
        } catch (err: any) {
          console.error(err);
          alert(err.message || 'Gagal memproses pesanan.');
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

  const handlePrint = (type: 'invoice' | 'receipt') => {
    setPrintType(type);
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const isKasir = profile?.role === 'kasir';

  return (
    <div className={`flex flex-col lg:flex-row gap-6 ${isKasir ? 'h-[calc(100vh-73px)]' : 'lg:h-[calc(100vh-120px)]'} overflow-hidden lg:overflow-visible ${isKasir ? 'p-4' : ''}`}>
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px] lg:min-h-0">
        {isSettledToday && (
          <div className="p-4 bg-red-50 border-b border-red-100 flex items-center text-red-700 text-sm font-bold animate-pulse">
            <AlertCircle className="w-5 h-5 mr-2" />
            Buku hari ini sudah ditutup (Settled). Tidak dapat memproses pesanan baru.
          </div>
        )}
        <div className="p-4 lg:p-6 border-b border-gray-100 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg lg:text-xl font-bold text-gray-900">Buat Pesanan Baru</h2>
            <button
              onClick={() => navigate('/sales/receive')}
              className="flex items-center px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-xs lg:text-sm font-bold"
            >
              <ListOrdered className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Daftar Pesanan</span>
              <span className="sm:hidden">Daftar</span>
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 lg:gap-4">
            <form onSubmit={handleBarcodeScan} className="flex-1 relative">
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-500" />
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Scan Barcode / SKU..."
                value={barcodeSearch}
                onChange={(e) => setBarcodeSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 lg:py-3 bg-indigo-50 border border-indigo-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900 placeholder:text-indigo-300 text-sm"
              />
            </form>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 lg:py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 lg:gap-4">
            <button 
              onClick={() => setOrderType('manual')}
              className={`flex-1 py-2 rounded-lg text-xs lg:text-sm font-bold flex items-center justify-center border transition-all ${orderType === 'manual' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              <Tag className="w-3 h-3 lg:w-4 lg:h-4 mr-1 lg:mr-2" />
              Manual
            </button>
            <button 
              onClick={() => setOrderType('service')}
              className={`flex-1 py-2 rounded-lg text-xs lg:text-sm font-bold flex items-center justify-center border transition-all ${orderType === 'service' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              <Briefcase className="w-3 h-3 lg:w-4 lg:h-4 mr-1 lg:mr-2" />
              Service
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
            {products
              .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
              .filter(p => (p.type || 'manual') === orderType)
              .map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={orderType === 'manual' && product.stock <= 0}
                className="flex flex-col text-left group bg-white border border-gray-100 rounded-xl p-2 lg:p-3 hover:border-indigo-500 hover:shadow-md transition-all disabled:opacity-50 active:scale-95"
              >
                <div className="aspect-square bg-gray-50 rounded-lg mb-2 lg:mb-3 overflow-hidden relative">
                  <img src={product.imageUrl || `https://picsum.photos/seed/${product.id}/200/200`} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  {orderType === 'manual' && product.stock <= 0 && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="text-[8px] lg:text-[10px] font-bold text-white bg-red-600 px-2 py-1 rounded">OUT OF STOCK</span>
                    </div>
                  )}
                  {product.variants && product.variants.length > 0 && (
                    <div className="absolute top-1 left-1">
                      <span className="bg-indigo-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg uppercase tracking-tighter">
                        Variasi
                      </span>
                    </div>
                  )}
                  {product.wholesalePrices && product.wholesalePrices.length > 0 && (
                    <div className="absolute top-1 right-1">
                      <span className="bg-green-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg uppercase tracking-tighter">
                        Grosir
                       </span>
                    </div>
                  )}
                  {product.type === 'service' && (
                    <div className="absolute bottom-1 right-1">
                      <span className="bg-orange-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg uppercase tracking-tighter">
                        Jasa
                      </span>
                    </div>
                  )}
                </div>
                <h4 className="text-xs lg:text-sm font-bold text-gray-900 truncate">{product.name}</h4>
                <div className="flex justify-between items-center mt-1 lg:mt-2">
                  <p className="text-indigo-600 font-extrabold text-xs lg:text-sm">Rp.{(product.price || 0).toLocaleString()}</p>
                  {orderType === 'manual' && <p className="text-[8px] lg:text-[10px] text-gray-500">{product.stock} left</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-96 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden lg:h-[calc(100vh-120px)] lg:sticky lg:top-0">
        <div className="p-3 lg:p-4 border-b border-gray-100 space-y-3">
          <h3 className="text-base lg:text-lg font-bold flex items-center">
            <ShoppingCart className="w-5 h-5 mr-2 text-indigo-600" />
            Order Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Select Customer</label>
              <select 
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs lg:text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Guest Customer</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 min-h-0">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-2 py-8">
              <ShoppingCart className="w-8 h-8" />
              <p className="text-xs font-bold">Cart is empty</p>
            </div>
          ) : (
            cart.map((item) => {
              const itemVid = (item as any).variantId;
              const variant = itemVid ? item.product.variants?.find((v: any) => v.id === itemVid) : null;
              const unitPrice = getProductPrice(item.product, itemVid);
              const basePrice = variant ? variant.price : item.product.price;
              const isDiscounted = unitPrice < basePrice;
              const cartItemId = itemVid ? `${item.product.id}-${itemVid}` : item.product.id;

              return (
                <div key={cartItemId} className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="text-xs lg:text-sm font-bold text-gray-900 leading-tight mb-1">
                      {item.product.name}
                      {variant && <span className="text-indigo-600 ml-1">[{variant.name}]</span>}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className={`text-[10px] lg:text-xs font-bold ${isDiscounted ? 'text-green-600' : 'text-gray-500'}`}>
                        Rp.{unitPrice.toLocaleString()}
                        {isDiscounted && (
                          <span className="text-[8px] lg:text-[10px] text-gray-400 line-through ml-1 font-medium">Rp.{basePrice.toLocaleString()}</span>
                        )}
                      </p>
                      {isDiscounted && (
                        <span className="text-[8px] text-green-600 font-bold bg-green-50 px-1 py-0.5 rounded border border-green-100">Grosir!</span>
                      )}
                    </div>
                    <p className="text-[10px] lg:text-xs text-gray-400 font-medium">Total: Rp.{(unitPrice * item.quantity).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0">
                    <button onClick={() => updateQuantity(cartItemId, -1)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"><Minus className="w-3 h-3 lg:w-4 lg:h-4" /></button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => setQuantity(cartItemId, parseInt(e.target.value) || 0)}
                      className="text-xs lg:text-sm font-black w-10 lg:w-12 text-center text-indigo-600 bg-gray-50 border-none outline-none focus:ring-1 focus:ring-indigo-500 rounded py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button onClick={() => updateQuantity(cartItemId, 1)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"><Plus className="w-3 h-3 lg:w-4 lg:h-4" /></button>
                    <button onClick={() => updateQuantity(cartItemId, -item.quantity)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition-colors ml-1"><Trash2 className="w-3 h-3 lg:w-4 lg:h-4" /></button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 lg:p-4 bg-gray-50 border-t border-gray-100 space-y-3">
          <div className="flex justify-between text-lg lg:text-xl font-extrabold text-gray-900 pt-2">
            <span>Total</span>
            <span>Rp.{(total || 0).toLocaleString()}</span>
          </div>
      <button
        onClick={(e) => {
          e.preventDefault();
          setIsCheckoutModalOpen(true);
        }}
        disabled={cart.length === 0 || isProcessing}
        className="w-full bg-indigo-600 text-white py-3 lg:py-4 rounded-xl font-bold text-base lg:text-lg hover:bg-indigo-700 transition-all flex items-center justify-center disabled:opacity-50 shadow-lg shadow-indigo-200 active:scale-95"
      >
        <CreditCard className="w-5 h-5 lg:w-6 lg:h-6 mr-2" />
        Checkout
      </button>

      {/* Variant Selection Modal */}
      <AnimatePresence>
        {selectedVariantProduct && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold">{selectedVariantProduct.name}</h3>
                    <p className="text-[10px] text-indigo-100 font-bold uppercase tracking-widest mt-1">Pilih Variasi Produk</p>
                </div>
                <button onClick={() => setSelectedVariantProduct(null)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-3">
                {selectedVariantProduct.variants?.map((v: any) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariantId(v.id)}
                    disabled={v.stock <= 0}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                      selectedVariantId === v.id 
                        ? 'border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-50' 
                        : 'border-gray-100 hover:border-indigo-200 bg-white'
                    } ${v.stock <= 0 ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                  >
                    <div className="text-left">
                        <p className={`font-bold ${selectedVariantId === v.id ? 'text-indigo-600' : 'text-gray-900'}`}>{v.name}</p>
                        <p className="text-[10px] text-gray-500 font-mono">{v.sku}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-black text-indigo-600">Rp.{v.price.toLocaleString()}</p>
                        <p className={`text-[9px] font-bold ${v.stock <= 5 ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>
                            {v.stock > 0 ? `Stok: ${v.stock}` : 'Stok Habis'}
                        </p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="p-6 pt-0">
                <button
                  onClick={() => addToCart(selectedVariantProduct, selectedVariantId)}
                  disabled={!selectedVariantId}
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-indigo-100 h-full active:scale-95 disabled:opacity-50"
                >
                  MASUKKAN PESANAN
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </div>
      </div>

      {/* Checkout Modal */}
      <AnimatePresence>
        {isCheckoutModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-[650px] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-600 text-white">
                <h3 className="text-xl font-bold flex items-center">
                  <CreditCard className="w-6 h-6 mr-2" />
                  Pembayaran
                </h3>
                <button
                  onClick={() => setIsCheckoutModalOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Metode Pembayaran</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setPaymentMethodType('tunai')}
                      className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border-2 transition-all flex flex-col items-center justify-center gap-2 ${paymentMethodType === 'tunai' ? 'bg-green-50 text-green-600 border-green-600' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                    >
                      <Landmark className="w-6 h-6" />
                      Tunai
                    </button>
                    <button
                      onClick={() => setPaymentMethodType('transfer')}
                      className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border-2 transition-all flex flex-col items-center justify-center gap-2 ${paymentMethodType === 'transfer' ? 'bg-blue-50 text-blue-600 border-blue-600' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                    >
                      <CreditCard className="w-6 h-6" />
                      Transfer
                    </button>
                  </div>
                </div>

                {paymentMethodType === 'transfer' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2"
                  >
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Pilih Bank</label>
                    <select 
                      value={selectedBankAccountId}
                      onChange={(e) => setSelectedBankAccountId(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    >
                      {bankAccounts.filter(b => b.name.toUpperCase() !== 'TUNAI').map(b => (
                        <option key={b.id} value={b.id}>{b.name} {b.accountNumber ? `(${b.accountNumber})` : ''}</option>
                      ))}
                      {bankAccounts.filter(b => b.name.toUpperCase() !== 'TUNAI').length === 0 && (
                        <option value="">Belum ada rekening bank</option>
                      )}
                    </select>
                  </motion.div>
                )}

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Tipe Transaksi</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setPaymentType('cash')}
                      className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border-2 transition-all ${paymentType === 'cash' ? 'bg-indigo-50 text-indigo-600 border-indigo-600' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                    >
                      Lunas
                    </button>
                    <button
                      onClick={() => {
                        if (canUseTempo) {
                          setPaymentType('credit');
                        }
                      }}
                      disabled={!canUseTempo}
                      className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border-2 transition-all ${paymentType === 'credit' ? 'bg-indigo-50 text-indigo-600 border-indigo-600' : 'bg-gray-50 text-gray-400 border-gray-100'} ${!canUseTempo ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Tempo
                    </button>
                  </div>
                  {!canUseTempo && selectedCustomer && (
                    <p className="text-[10px] text-red-500 font-bold mt-1">
                      * Pelanggan ini tidak diizinkan untuk pembayaran Tempo.
                    </p>
                  )}
                  {!selectedCustomer && (
                    <p className="text-[10px] text-orange-500 font-bold mt-1">
                      * Pilih pelanggan Langganan untuk mengaktifkan pembayaran Tempo.
                    </p>
                  )}
                </div>

                {paymentType === 'cash' && paymentMethodType === 'tunai' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Uang Diterima (Bayar)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rp</span>
                        <input
                          type="number"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(Number(e.target.value))}
                          className="w-full pl-12 pr-4 py-3 bg-green-50 border-2 border-green-100 rounded-2xl text-lg font-black text-green-900 outline-none focus:ring-2 focus:ring-green-500 transition-all"
                        />
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl border-2 border-gray-100 flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Kembalian</span>
                      <span className={`text-xl font-black ${change >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
                        Rp.{change.toLocaleString()}
                      </span>
                    </div>
                  </motion.div>
                )}

                {paymentType === 'credit' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2"
                  >
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Amount Paid (DP)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rp</span>
                      <input
                        type="number"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(Number(e.target.value))}
                        className="w-full pl-12 pr-4 py-3 bg-indigo-50 border-2 border-indigo-100 rounded-2xl text-lg font-black text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                    {amountPaid < total && (
                      <p className="text-xs text-red-500 font-bold text-right">
                        Sisa: Rp.{(total - amountPaid).toLocaleString()}
                      </p>
                    )}
                  </motion.div>
                )}
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Total Tagihan</span>
                  <span className="text-2xl font-black text-gray-900">Rp.{total.toLocaleString()}</span>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={isProcessing || (paymentType === 'cash' && paymentMethodType === 'tunai' && cashReceived < total)}
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all flex items-center justify-center disabled:opacity-50 shadow-xl shadow-indigo-100 active:scale-95"
                >
                  {isProcessing ? (
                    <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin mr-3" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6 mr-3" />
                  )}
                  {isProcessing ? 'Memproses...' : 'Simpan Pesanan'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {confirmConfig && (
        <ConfirmModal
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(null)}
        />
      )}

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-[500px] overflow-hidden text-center p-10"
            >
              <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">Pesanan Berhasil!</h3>
              <p className="text-gray-500 font-medium mb-8 leading-relaxed">
                Order <span className="text-indigo-600 font-black">#{lastOrderNumber}</span> telah berhasil diproses.
              </p>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  onClick={() => handlePrint('invoice')}
                  className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
                >
                  <FileText className="w-6 h-6 text-gray-400 group-hover:text-indigo-600 mb-2" />
                  <span className="text-xs font-bold text-gray-600 group-hover:text-indigo-700">Faktur (A4)</span>
                </button>
                <button
                  onClick={() => handlePrint('receipt')}
                  className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
                >
                  <Printer className="w-6 h-6 text-gray-400 group-hover:text-indigo-600 mb-2" />
                  <span className="text-xs font-bold text-gray-600 group-hover:text-indigo-700">Struk (80mm)</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    navigate('/sales/receive');
                  }}
                  className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  Lihat Daftar Pesanan
                </button>
                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-all"
                >
                  Buat Pesanan Baru
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Print Templates */}
      <div className={`${printType ? 'block' : 'hidden'} print:block print-section fixed inset-0 bg-white z-[9999] overflow-auto`}>
        {lastOrder && (
          <>
            {printType === 'invoice' && (
              <div className="p-10 text-black font-sans bg-white min-h-screen">
                <div className="max-w-4xl mx-auto">
                  <div className="flex justify-between items-start mb-10">
                    <div>
                      <h1 className="text-4xl font-black text-indigo-600 mb-1">{tenantInfo?.name || 'ZENTORY'}</h1>
                      <p className="text-sm text-gray-500 max-w-xs">{tenantInfo?.settings?.description || 'Business Inventory & Sales Solutions'}</p>
                    </div>
                    <div className="text-right">
                      <h2 className="text-3xl font-bold text-gray-900 uppercase tracking-tighter">INVOICE</h2>
                      <p className="text-sm font-mono text-gray-500">#{lastOrder.orderNumber}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {lastOrder.date ? new Date(lastOrder.date.seconds * 1000).toLocaleDateString() : ''}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-10 mb-10 border-y border-gray-100 py-6">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Billed To</p>
                      <p className="text-lg font-bold text-gray-900">{lastOrder.customerName}</p>
                      <p className="text-sm text-gray-500 uppercase">{lastOrder.type} Order</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Payment Status</p>
                      <p className="text-lg font-bold text-indigo-600 uppercase">{lastOrder.status}</p>
                    </div>
                  </div>

                  <table className="w-full mb-10">
                    <thead>
                      <tr className="border-b-2 border-gray-900 text-left text-xs font-bold uppercase tracking-wider">
                        <th className="py-3">Description</th>
                        <th className="py-3 text-center">Quantity</th>
                        <th className="py-3 text-right">Unit Price</th>
                        <th className="py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lastOrder.items.map((item: any, i: number) => (
                        <tr key={i} className="text-sm">
                          <td className="py-4 font-medium">{item.name}</td>
                          <td className="py-4 text-center">{item.quantity}</td>
                          <td className="py-4 text-right">Rp.{item.price.toLocaleString()}</td>
                          <td className="py-4 text-right font-bold">Rp.{(item.price * item.quantity).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-900">
                        <td colSpan={3} className="py-6 text-right font-bold text-gray-500 uppercase tracking-widest">Grand Total</td>
                        <td className="py-6 text-right text-2xl font-black text-indigo-600">
                          Rp.{lastOrder.totalAmount.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  <div className="mt-20 pt-10 border-t border-gray-100 text-center">
                    <p className="text-sm font-bold text-gray-900">Thank you for your business!</p>
                    <p className="text-xs text-gray-400 mt-1">Generated by Zentory POS System</p>
                  </div>
                </div>
              </div>
            )}

            {printType === 'receipt' && (
              <div className="p-4 text-black font-mono text-[10px] w-[80mm] mx-auto bg-white min-h-screen">
                <div className="text-center mb-4">
                  <h1 className="text-base font-bold uppercase">{tenantInfo?.name || 'ZENTORY'}</h1>
                  <p className="text-[8px]">{tenantInfo?.settings?.description || 'Sales Receipt'}</p>
                </div>
                
                <div className="border-t border-dashed border-gray-300 py-2 mb-2">
                  <div className="flex justify-between">
                    <span>Order:</span>
                    <span>#{lastOrder.orderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <span>{lastOrder.date ? new Date(lastOrder.date.seconds * 1000).toLocaleString() : ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cust:</span>
                    <span>{lastOrder.customerName}</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-gray-300 py-2 mb-2">
                  {lastOrder.items.map((item: any, i: number) => (
                    <div key={i} className="mb-1">
                      <div className="flex justify-between">
                        <span>{item.name}</span>
                      </div>
                      <div className="flex justify-between pl-2">
                        <span>{item.quantity} x {item.price.toLocaleString()}</span>
                        <span>{(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-gray-300 py-2 font-bold text-xs">
                  <div className="flex justify-between">
                    <span>TOTAL</span>
                    <span>Rp.{lastOrder.totalAmount.toLocaleString()}</span>
                  </div>
                </div>

                <div className="text-center mt-6">
                  <p>TERIMA KASIH</p>
                  <p className="text-[8px] mt-1">Zentory POS System</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
