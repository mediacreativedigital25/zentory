import React, { useState, useMemo, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, onSnapshot, runTransaction, Timestamp, limit, orderBy } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
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
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');
  const [isLoadingCoupon, setIsLoadingCoupon] = useState(false);
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
    if (product.variants && product.variants.length > 0 && !variantId) {
      setSelectedVariantProduct(product);
      setSelectedVariantId(product.variants[0].id);
      return;
    }

    const variant = variantId ? product.variants?.find((v: any) => v.id === variantId) : null;
    const isService = product.type === 'service' || (variant && variant.type === 'non-stock');
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
        const variant = itemVid ? item.product.variants?.find((v: any) => v.id === itemVid) : null;
        const isService = item.product.type === 'service' || (variant && variant.type === 'non-stock');
        
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
        const variant = itemVid ? item.product.variants?.find((v: any) => v.id === itemVid) : null;
        const isService = item.product.type === 'service' || (variant && variant.type === 'non-stock');

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

  
  const subtotal = cart.reduce((acc, item) => acc + (getProductPrice(item.product, (item as any).variantId) * item.quantity), 0);
  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === 'percentage') {
      return (subtotal * appliedCoupon.value) / 100;
    }
    return appliedCoupon.value;
  }, [appliedCoupon, subtotal]);
  const total = Math.round(Math.max(0, subtotal - discountAmount));

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
    const targetTenantId = domainTenantId || profile?.tenantId;
    const { generateSequentialNumber } = await import('../lib/sequence');
    return await generateSequentialNumber(targetTenantId || '', 'INV');
  };

  const currentCustomer = customers.find(c => c.id === selectedCustomer);
  const canUseTempo = currentCustomer?.type === 'langganan' && currentCustomer?.allowTempo;

  
  const handleApplyCoupon = async () => {
    const ptId = profile?.tenantId || '';
    if (!couponCodeInput.trim() || !ptId) return;
    setIsLoadingCoupon(true);
    setCouponError('');
    setCouponSuccess('');
    try {
      const code = couponCodeInput.toUpperCase().replace(/\s/g, '');
      const q = query(
        collection(db, 'coupons'),
        where('tenantId', '==', ptId),
        where('code', '==', code),
        where('isActive', '==', true)
      );
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setCouponError('Kupon tidak valid atau sudah tidak aktif.');
        return;
      }

      const couponData = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
      
      // Validations
      const now = new Date();
      if (couponData.startDate && now < new Date(couponData.startDate)) {
        setCouponError('Kupon belum dimulai.');
        return;
      }
      if (couponData.endDate && now > new Date(couponData.endDate)) {
        setCouponError('Kupon sudah kadaluarsa.');
        return;
      }
      if (couponData.usageLimit > 0 && couponData.usedCount >= couponData.usageLimit) {
        setCouponError('Kupon sudah mencapai batas penggunaan.');
        return;
      }
      
      const currentSubtotal = cart.reduce((acc: number, item: any) => acc + (getProductPrice(item.product, (item as any).variantId) * item.quantity), 0);

      if (currentSubtotal < couponData.minPurchase) {
        setCouponError(`Minimal pembelian Rp ${Math.round(couponData.minPurchase).toLocaleString('id-ID')}`);
        return;
      }
      
      if (couponData.category !== 'all') {
        const itemArray = cart;
        const hasValidCategory = itemArray.some((item: any) => (item.product?.category || item.category) === couponData.category);
        if (!hasValidCategory) {
          setCouponError('Kupon tidak berlaku untuk produk di keranjang Anda.');
          return;
        }
      }

      setAppliedCoupon(couponData);
      setCouponSuccess('Kupon berhasil diterapkan!');
    } catch (err) {
      console.error('Error applying coupon:', err);
      setCouponError('Gagal memeriksa kupon.');
    } finally {
      setIsLoadingCoupon(false);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || isProcessing) return;

    if (paymentMethodType === 'transfer' && !selectedBankAccountId) {
      alert('Silakan pilih bank terlebih dahulu.');
      return;
    }

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
          const { generateSequentialNumber } = await import('../lib/sequence');
          let orderNumber = await generateSequentialNumber(targetTenantId || '', 'INV');

          const customer = customers.find(c => c.id === selectedCustomer);
          
          const orderRef = doc(collection(db, 'orders'));
          const customerCode = customer?.code || '';

          // Calculate Due Date if credit
          let dueDate = null;
          if (paymentType === 'credit' && customer?.allowTempo) {
            const days = customer.tempoLimitDays || 30;
            const date = new Date();
            date.setDate(date.getDate() + days);
            dueDate = Timestamp.fromDate(date);
          }

          let status = 'pending';
          let paymentStatus = 'unpaid';
          let actualPaidAmount = 0;
          
          if (paymentType === 'cash') {
            status = 'completed';
            paymentStatus = 'paid';
            actualPaidAmount = total;
          }

          const stockLogsToProcess: any[] = [];
          await runTransaction(db, async (transaction) => {
            // 1. READS FIRST
            const productDocs: { ref: any; data: Product; item: any }[] = [];
            if (orderType === 'manual' || isKasir) {
              for (const item of cart) {
                const productRef = doc(db, 'products', item.product.id);
                const pDoc = await transaction.get(productRef);
                if (!pDoc.exists()) throw new Error(`Product ${item.product.name} not found`);
                productDocs.push({
                  ref: productRef,
                  data: pDoc.data() as Product,
                  item
                });
              }
            }

            // 2. CALCULATIONS
            const productUpdatesMap = new Map<string, { ref: any; updateData: any; productData: Product }>();

            for (const pInfo of productDocs) {
              const productData = pInfo.data;
              const item = pInfo.item;
              const itemVid = (item as any).variantId;
              const variant = itemVid ? productData.variants?.find((v: any) => v.id === itemVid) : null;
              const isService = productData.type === 'service' || (variant && variant.type === 'non-stock');
              
              if (!isService) {
                // Get the current base reference if it exists in the map
                const existingUpdate = productUpdatesMap.get(item.product.id);
                const currentProductData = existingUpdate ? existingUpdate.productData : { ...productData, variants: productData.variants ? [...productData.variants] : [] };
                
                let currentItemStock = 0;
                let updateData: any = existingUpdate ? { ...existingUpdate.updateData } : {};

                if (itemVid && currentProductData.variants) {
                  const variantIndex = currentProductData.variants.findIndex(v => v.id === itemVid);
                  if (variantIndex === -1) throw new Error(`Variant not found for ${currentProductData.name}`);
                  
                  const targetVariant = currentProductData.variants[variantIndex];
                  currentItemStock = targetVariant.stock;
                  if (currentItemStock < item.quantity) {
                    throw new Error(`Stok variasi ${targetVariant.name} untuk ${currentProductData.name} tidak mencukupi`);
                  }

                  currentProductData.variants[variantIndex] = {
                    ...targetVariant,
                    stock: targetVariant.stock - item.quantity
                  };

                  updateData = {
                    ...updateData,
                    variants: currentProductData.variants,
                    stock: (currentProductData.stock || 0) - item.quantity // Decrease total stock too
                  };
                  // Apply total stock safely:
                  currentProductData.stock = updateData.stock;
                } else {
                  currentItemStock = currentProductData.stock || 0;
                  if (currentItemStock < item.quantity) {
                    throw new Error(`Stok ${currentProductData.name} tidak mencukupi`);
                  }
                  
                  updateData = {
                    ...updateData,
                    stock: currentItemStock - item.quantity
                  };
                  currentProductData.stock = updateData.stock;
                }

                productUpdatesMap.set(item.product.id, {
                  ref: pInfo.ref,
                  updateData,
                  productData: currentProductData
                });

                const logName = variant ? `${currentProductData.name} (${variant.name})` : currentProductData.name;
                stockLogsToProcess.push({
                  productId: item.product.id,
                  name: logName,
                  qty: item.quantity,
                  prev: currentItemStock,
                  curr: currentItemStock - item.quantity,
                  variant: !!itemVid
                });
              }
            }

            // 3. WRITES LAST
            if (appliedCoupon) {
              const couponRef = doc(db, 'coupons', appliedCoupon.id);
              const cDoc = await transaction.get(couponRef);
              if (cDoc.exists()) {
                transaction.update(couponRef, { usedCount: (cDoc.data().usedCount || 0) + 1 });
              }
            }
            
            for (const update of productUpdatesMap.values()) {
              transaction.update(update.ref, update.updateData);
            }

            // Create Order
            transaction.set(orderRef, {
              orderNumber,
              tenantId: targetTenantId,
              customerId: selectedCustomer || null,
              customerName: customer?.name || 'Guest',
              customerCode,
              type: isKasir ? 'pos' : orderType,
            items: cart.map(item => {
              const itemVid = (item as any).variantId;
              const variant = itemVid ? item.product.variants?.find((v: any) => v.id === itemVid) : null;
              const unitPrice = getProductPrice(item.product, itemVid);
              const name = variant ? `${item.product.name} (${variant.name})` : item.product.name;
              
              return {
                productId: item.product.id,
                businessLineId: item.product.businessLineId || null,
                variantId: itemVid || null,
                name,
                quantity: item.quantity,
                price: unitPrice,
                hpp: variant ? (variant.hpp || 0) : (item.product.hpp || 0)
              };
            }),
              totalAmount: total,
              discountAmount: discountAmount || 0,
              couponId: appliedCoupon?.id || null,
              couponCode: appliedCoupon?.code || null,

              paidAmount: actualPaidAmount,
              paymentStatus,
              paymentType,
              date: serverTimestamp(),
              dueDate,
              status: status,
              userId: profile?.uid,
              paymentMethod: selectedBankAccountId || null,
              createdAt: serverTimestamp()
            });
          });

          // 4. LOG STOCK CHANGES AFTER SUCCESS
          for (const log of stockLogsToProcess) {
            logStockChange(
              targetTenantId!,
              log.productId,
              log.name,
              'SALE',
              log.qty,
              log.prev,
              log.curr,
              profile?.uid!,
              profile?.displayName || 'System',
              { id: orderRef.id, number: orderNumber },
              `Sales Order ${log.variant ? '(Variant)' : ''}`
            );
          }

          if (paymentType === 'cash') {
            await addDoc(collection(db, 'transactions'), {
              tenantId: targetTenantId,
              type: 'sale',
              category: 'Sales',
              amount: total,
              discountAmount: discountAmount,
              items: cart.map(item => {
                const itemVid = (item as any).variantId;
                const variant = itemVid ? item.product.variants?.find((v: any) => v.id === itemVid) : null;
                return {
                  productId: item.product.id,
                  variantId: itemVid || null,
                  name: variant ? `${item.product.name} (${variant.name})` : item.product.name,
                  price: getProductPrice(item.product, itemVid),
                  hpp: variant ? (variant.hpp || 0) : (item.product.hpp || 0),
                  quantity: item.quantity
                };
              }),
              description: `Sales from Kasir/Manual: ${orderNumber}`,
              transactionNumber: `TRX-${orderNumber}`,
              orderId: orderRef.id,
              orderNumber: orderNumber,
              status: 'completed',
              date: serverTimestamp(),
              userId: profile?.uid,
              bankAccountId: selectedBankAccountId || null,
              createdAt: serverTimestamp()
            });
          }

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
          setAppliedCoupon(null);
          setCouponCodeInput('');
          setCouponSuccess('');
          setCouponError('');
          setSelectedCustomer('');
          setAmountPaid(0);
          setCashReceived(0);
        } catch (err: any) {
          console.error('Error saving order:', err);
          handleFirestoreError(err, OperationType.WRITE, 'orders/transaction', auth, profile);
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

  const handlePrint = (type: 'invoice' | 'receipt') => {
    if (lastOrder?.id) {
      window.open(`/print/${type}/${lastOrder.id}`, '_blank');
    }
  };

  const isKasir = profile?.role === 'kasir';

  return (
    <div className={`flex flex-col lg:flex-row gap-6 ${isKasir ? 'h-[calc(100vh-73px)]' : 'lg:h-[calc(100vh-120px)]'} overflow-hidden lg:overflow-visible ${isKasir ? 'p-4' : ''}`}>
      <div className="flex-1 flex flex-col bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden min-h-[500px] lg:min-h-0">
        {isSettledToday && (
          <div className="p-4 bg-red-50 border-b border-red-100 flex items-center text-red-700 text-sm font-bold animate-pulse">
            <AlertCircle className="w-5 h-5 mr-2" />
            Buku hari ini sudah ditutup (Settled). Tidak dapat memproses pesanan baru.
          </div>
        )}
        <div className="p-4 lg:p-6 border-b border-gray-100 space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h2 className="text-lg lg:text-xl font-bold text-gray-900">Buat Pesanan Baru</h2>
            </div>
            <button
              onClick={() => navigate('/sales/receive')}
              className="flex items-center px-3 py-2 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 transition-colors text-xs lg:text-sm font-bold"
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
                className="w-full pl-12 pr-4 py-2.5 lg:py-3 bg-indigo-50 border border-indigo-100 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-indigo-900 placeholder:text-indigo-300 text-sm"
              />
            </form>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 lg:py-3 bg-white border border-gray-100 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 lg:gap-4">
            <button 
              onClick={() => setOrderType('manual')}
              className={`flex-1 py-2 rounded-md text-xs lg:text-sm font-bold flex items-center justify-center border transition-all ${orderType === 'manual' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              <Tag className="w-3 h-3 lg:w-4 lg:h-4 mr-1 lg:mr-2" />
              Manual
            </button>
            <button 
              onClick={() => setOrderType('service')}
              className={`flex-1 py-2 rounded-md text-xs lg:text-sm font-bold flex items-center justify-center border transition-all ${orderType === 'service' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
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
                className="flex flex-col text-left group bg-white border border-gray-100 rounded-md p-2 lg:p-3 hover:border-indigo-500 hover:shadow-md transition-all disabled:opacity-50 active:scale-95"
              >
                <div className="aspect-square bg-gray-50 rounded-md mb-2 lg:mb-3 overflow-hidden relative">
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
                  <p className="text-indigo-600 font-extrabold text-xs lg:text-sm">Rp.{Math.round(product.price || 0).toLocaleString('id-ID')}</p>
                  {orderType === 'manual' && <p className="text-[8px] lg:text-[10px] text-gray-500">{product.stock} left</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-96 flex flex-col bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden lg:h-[calc(100vh-120px)] lg:sticky lg:top-0">
        <div className="p-3 lg:p-4 border-b border-gray-100 space-y-3">
          <h3 className="text-base lg:text-lg font-bold flex items-center">
            <ShoppingCart className="w-5 h-5 mr-2 text-indigo-600" />
            Order Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
            <div>
              <label className="block mb-1 text-xs font-semibold text-gray-600">Select Customer</label>
              <select 
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-100 rounded-md text-xs lg:text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Guest Customer</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} {c.code ? `(${c.code})` : `(${c.phone})`}</option>
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
                        Rp.{Math.round(unitPrice).toLocaleString('id-ID')}
                        {isDiscounted && (
                          <span className="text-[8px] lg:text-[10px] text-gray-400 line-through ml-1 font-medium">Rp.{Math.round(basePrice).toLocaleString('id-ID')}</span>
                        )}
                      </p>
                      {isDiscounted && (
                        <span className="text-[8px] text-green-600 font-bold bg-green-50 px-1 py-0.5 rounded border border-green-100">Grosir!</span>
                      )}
                    </div>
                    <p className="text-[10px] lg:text-xs text-gray-400 font-medium">Total: Rp.{Math.round(unitPrice * item.quantity).toLocaleString('id-ID')}</p>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0">
                    <button onClick={() => updateQuantity(cartItemId, -1)} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400 transition-colors"><Minus className="w-3 h-3 lg:w-4 lg:h-4" /></button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => setQuantity(cartItemId, parseInt(e.target.value) || 0)}
                      className="text-xs lg:text-sm font-medium w-10 lg:w-12 text-center text-indigo-600 bg-white border border-gray-200 outline-none focus:ring-1 focus:ring-indigo-500 rounded py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button onClick={() => updateQuantity(cartItemId, 1)} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400 transition-colors"><Plus className="w-3 h-3 lg:w-4 lg:h-4" /></button>
                    <button onClick={() => updateQuantity(cartItemId, -item.quantity)} className="p-1.5 hover:bg-red-50 rounded-md text-red-500 transition-colors ml-1"><Trash2 className="w-3 h-3 lg:w-4 lg:h-4" /></button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 lg:p-4 bg-gray-50 border-t border-gray-100 space-y-3">
          <div className="flex justify-between text-lg lg:text-xl font-extrabold text-gray-900 pt-2">
            <span>Total</span>
            <span>Rp.{Math.round(total || 0).toLocaleString('id-ID')}</span>
          </div>
      <button
        onClick={(e) => {
          e.preventDefault();
          setIsCheckoutModalOpen(true);
        }}
        disabled={cart.length === 0 || isProcessing}
        className="w-full bg-indigo-600 text-white py-3 lg:py-4 rounded-md font-bold text-base lg:text-lg hover:bg-indigo-700 transition-all flex items-center justify-center disabled:opacity-50 shadow-lg shadow-indigo-200 active:scale-95"
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
              className="bg-white rounded-md shadow-2xl w-full max-w-sm flex flex-col max-h-[90vh] overflow-hidden"
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
              <div className="p-6 space-y-3" flex-1 overflow-y-auto auto-rows-max>
                {selectedVariantProduct.variants?.map((v: any) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariantId(v.id)}
                    disabled={v.stock <= 0}
                    className={`w-full flex items-center justify-between p-4 rounded-md border-2 transition-all ${
                      selectedVariantId === v.id 
                        ? 'border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-50' 
                        : 'border-gray-100 hover:border-indigo-200 bg-white'
                    } ${v.stock <= 0 ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                  >
                    <div className="flex items-center gap-4 text-left">
                        {v.imageUrl && (
                          <div className="w-12 h-12 rounded-md overflow-hidden border border-gray-100 flex-shrink-0">
                            <img src={v.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt={v.name} />
                          </div>
                        )}
                        <div>
                          <p className={`font-bold ${selectedVariantId === v.id ? 'text-indigo-600' : 'text-gray-900'}`}>{v.name}</p>
                          <p className="text-[10px] text-gray-500 font-mono">{v.sku}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="font-black text-indigo-600">Rp.{Math.round(v.price).toLocaleString('id-ID')}</p>
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
                  className="w-full bg-indigo-600 text-white py-4 rounded-md font-black shadow-xl shadow-indigo-100 h-full active:scale-95 disabled:opacity-50"
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
              className="bg-white rounded-xl shadow-2xl w-full max-w-[650px] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-600 text-white">
                <h3 className="text-xl font-bold flex items-center">
                  <CreditCard className="w-6 h-6 mr-2" />
                  Pembayaran
                </h3>
                <button
                  onClick={() => setIsCheckoutModalOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-md transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
                <div className="space-y-3">
                  <label className="block tracking-wider text-xs font-semibold text-gray-600">Metode Pembayaran</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setPaymentMethodType('tunai')}
                      className={`flex-1 py-3 rounded-md text-xs font-black uppercase tracking-widest border-2 transition-all flex flex-col items-center justify-center gap-2 ${paymentMethodType === 'tunai' ? 'bg-green-50 text-green-600 border-green-600' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                    >
                      <Landmark className="w-6 h-6" />
                      Tunai
                    </button>
                    <button
                      onClick={() => setPaymentMethodType('transfer')}
                      className={`flex-1 py-3 rounded-md text-xs font-black uppercase tracking-widest border-2 transition-all flex flex-col items-center justify-center gap-2 ${paymentMethodType === 'transfer' ? 'bg-blue-50 text-blue-600 border-blue-600' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
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
                    <label className="block tracking-wider text-xs font-semibold text-gray-600">Pilih Bank</label>
                    <select 
                      value={selectedBankAccountId}
                      onChange={(e) => setSelectedBankAccountId(e.target.value)}
                      className="w-full p-2 bg-white border-2 border-gray-100 rounded-md text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
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
                  <label className="block tracking-wider text-xs font-semibold text-gray-600">Tipe Transaksi</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setPaymentType('cash')}
                      className={`flex-1 py-3 rounded-md text-xs font-black uppercase tracking-widest border-2 transition-all ${paymentType === 'cash' ? 'bg-indigo-50 text-indigo-600 border-indigo-600' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
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
                      className={`flex-1 py-3 rounded-md text-xs font-black uppercase tracking-widest border-2 transition-all ${paymentType === 'credit' ? 'bg-indigo-50 text-indigo-600 border-indigo-600' : 'bg-gray-50 text-gray-400 border-gray-100'} ${!canUseTempo ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                      <label className="block tracking-wider text-xs font-semibold text-gray-600">Uang Diterima (Bayar)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rp</span>
                        <input
                          type="text"
                          value={cashReceived > 0 ? cashReceived.toLocaleString('id-ID') : ''}
                          onChange={(e) => {
                            let val = e.target.value.replace(/\./g, '');
                            val = val.replace(/\D/g, '');
                            setCashReceived(Number(val));
                          }}
                          className="w-full pl-12 pr-4 py-3 bg-green-50 border-2 border-green-100 rounded-md text-lg font-medium text-green-900 outline-none focus:ring-2 focus:ring-green-500 transition-all"
                        />
                      </div>
                    </div>
                    <div className="p-4 bg-white rounded-md border-2 border-gray-100 flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Kembalian</span>
                      <span className={`text-xl font-black ${change >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
                        Rp.{Math.round(change).toLocaleString('id-ID')}
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
                    <label className="block tracking-wider text-xs font-semibold text-gray-600">Amount Paid (DP)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rp</span>
                      <input
                        type="text"
                        value={amountPaid > 0 ? amountPaid.toLocaleString('id-ID') : ''}
                        onChange={(e) => {
                          let val = e.target.value.replace(/\./g, '');
                          val = val.replace(/\D/g, '');
                          setAmountPaid(Number(val));
                        }}
                        className="w-full pl-12 pr-4 py-3 bg-indigo-50 border-2 border-indigo-100 rounded-md text-lg font-medium text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                    {amountPaid < total && (
                      <p className="text-xs text-red-500 font-bold text-right">
                        Sisa: Rp.{Math.round(total - amountPaid).toLocaleString('id-ID')}
                      </p>
                    )}
                  </motion.div>
                )}
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50">
                
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <div className="bg-white/50 p-4 border border-gray-100 rounded-md space-y-3">
                    <label className="block text-xs font-semibold text-gray-600">Kupon Diskon (Opsional)</label>
                    <div className="flex gap-2">
                       <input
                          type="text"
                          placeholder="Masukkan kode kupon"
                          value={couponCodeInput}
                          onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                          disabled={!!appliedCoupon || isLoadingCoupon}
                          className="flex-1 p-2 border border-gray-200 bg-white rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                       />
                       {!appliedCoupon ? (
                         <button onClick={(e) => { e.preventDefault(); handleApplyCoupon(); }} disabled={isLoadingCoupon || !couponCodeInput} className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-bold w-24">Pasang</button>
                       ) : (
                         <button onClick={(e) => { e.preventDefault(); setAppliedCoupon(null); setCouponSuccess(''); setCouponError(''); setCouponCodeInput(''); }} className="px-4 py-2 bg-red-100 text-red-600 rounded-md text-sm font-bold w-24">Hapus</button>
                       )}
                    </div>
                    {couponError && <p className="text-xs text-red-500 font-bold">{couponError}</p>}
                    {couponSuccess && <p className="text-xs text-green-500 font-bold">{couponSuccess}</p>}
                    {appliedCoupon && (
                      <div className="text-sm font-bold text-green-600">Diskon: - Rp {Math.round(discountAmount).toLocaleString('id-ID')}</div>
                    )}
                  </div>
                </div>
  
                <div className="flex justify-between items-center gap-4 mb-4 mt-6 text-sm font-bold text-gray-500"><span className="uppercase">Subtotal</span><span>Rp.{Math.round(subtotal).toLocaleString('id-ID')}</span></div>
                
                <div className="flex justify-between items-center mb-6">
                  <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Total Tagihan</span>
                  {appliedCoupon && <span className="text-sm text-green-500 font-bold ml-2">(Telah Dipotong Diskon)</span>}
                  <span className="text-2xl font-black text-gray-900">Rp.{Math.round(total).toLocaleString('id-ID')}</span>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={isProcessing || (paymentType === 'cash' && paymentMethodType === 'tunai' && cashReceived < total) || (paymentMethodType === 'transfer' && !selectedBankAccountId)}
                  className="w-full bg-indigo-600 text-white py-4 rounded-md font-black text-lg hover:bg-indigo-700 transition-all flex items-center justify-center disabled:opacity-50 shadow-xl shadow-indigo-100 active:scale-95"
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
              className="bg-white rounded-xl shadow-2xl w-full max-w-[500px] overflow-hidden text-center p-10"
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
                  className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-md border border-gray-100 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
                >
                  <FileText className="w-6 h-6 text-gray-400 group-hover:text-indigo-600 mb-2" />
                  <span className="text-xs font-bold text-gray-600 group-hover:text-indigo-700">Faktur (A4)</span>
                </button>
                <button
                  onClick={() => handlePrint('receipt')}
                  className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-md border border-gray-100 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
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
                  className="w-full py-4 bg-indigo-600 text-white rounded-md font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  Lihat Daftar Pesanan
                </button>
                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="w-full py-4 bg-gray-900 text-white rounded-md font-bold hover:bg-gray-800 transition-all"
                >
                  Buat Pesanan Baru
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
