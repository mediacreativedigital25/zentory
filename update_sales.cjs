const fs = require('fs');

function applyCouponLogic(filePath, isV1) {
  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes('couponCodeInput')) return; // already applied

  // 1. Add state variables
  const stateHooksRegex = /const \[cart[^\]]*,[^\]]*\] = useState[^;]*;/;
  let stateHooksMatch = content.match(stateHooksRegex);
  if (!stateHooksMatch) {
     // trying to find alternative match for V1
     const altStateHooksRegex = /const \[cartItems,[^\]]*\] = useState[^;]*;/;
     stateHooksMatch = content.match(altStateHooksRegex);
  }

  if (stateHooksMatch) {
    const hooksCode = `
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');
  const [isLoadingCoupon, setIsLoadingCoupon] = useState(false);
`;
    content = content.replace(stateHooksMatch[0], stateHooksMatch[0] + hooksCode);
  } else {
      console.log('could not find state inject for', filePath);
  }

  // 2. Add handleApplyCoupon logic
  const handleCheckoutRegex = /const handleCheckout = /;
  const targetRegex = handleCheckoutRegex; // actually both SalesOrder & Sales have handleCheckout, V1 has handleSubmit ? Let's check wait. I will just inject right before it.
  
  // wait we need to use substring injection.
  let anchorPoint = isV1 ? "const handleSubmit =" : "const handleCheckout =";
  if (!content.includes(anchorPoint) && isV1) {
    anchorPoint = "const handlePreSubmit =";
  }

  const couponLogic = `
  const handleApplyCoupon = async () => {
    const ptId = profile?.tenantId || '';
    if (!couponCodeInput.trim() || !ptId) return;
    setIsLoadingCoupon(true);
    setCouponError('');
    setCouponSuccess('');
    try {
      const code = couponCodeInput.toUpperCase().replace(/\\s/g, '');
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
      
      const currentSubtotal = ${isV1 ? 'cartItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)' : 'cart.reduce((acc: number, item: any) => acc + (getProductPrice(item.product, (item as any).variantId) * item.quantity), 0)'};

      if (currentSubtotal < couponData.minPurchase) {
        setCouponError(\`Minimal pembelian Rp \${couponData.minPurchase.toLocaleString()}\`);
        return;
      }
      
      if (couponData.category !== 'all') {
        const itemArray = ${isV1 ? 'cartItems' : 'cart'};
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
`;
  content = content.replace(anchorPoint, couponLogic + "\n  " + anchorPoint);

  // 3. Mod total calculation
  if (!isV1) {
    const totalCalcRegex = /const total = cart\.reduce\([^;]*;/;
    const totalCalcMatch = content.match(totalCalcRegex);
    if (totalCalcMatch) {
       const replacement = `
  const subtotal = cart.reduce((acc, item) => acc + (getProductPrice(item.product, (item as any).variantId) * item.quantity), 0);
  const discountAmount = React.useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === 'percentage') {
      return (subtotal * appliedCoupon.value) / 100;
    }
    return appliedCoupon.value;
  }, [appliedCoupon, subtotal]);
  const total = Math.max(0, subtotal - discountAmount);`;
       content = content.replace(totalCalcMatch[0], replacement);
    } else {
        console.log("Could not replace total calculation for ", filePath);
    }
  } else {
    // V1 modification
    const totalV1Regex = /const totalAmount = cartItems\.reduce[^;]*;/;
    const matchV1 = content.match(totalV1Regex);
    if (matchV1) {
        const replacementV1 = `
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountAmount = React.useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === 'percentage') {
      return (subtotal * appliedCoupon.value) / 100;
    }
    return appliedCoupon.value;
  }, [appliedCoupon, subtotal]);
  const totalAmount = Math.max(0, subtotal - discountAmount);`;
        content = content.replace(matchV1[0], replacementV1);
    }
  }

  // 4. Update the write logic for coupon properties
  if (!isV1) {
      content = content.replace(/totalAmount: total,([\s\S]*?)paidAmount: (.*?),/, "totalAmount: total,\n              discountAmount: discountAmount || 0,\n              couponId: appliedCoupon?.id || null,\n              couponCode: appliedCoupon?.code || null,\n$1paidAmount: $2,");
      
      // Update coupon usage count
      content = content.replace(/for \(const update of productUpdates\) {/g, `if (appliedCoupon) {
              const couponRef = doc(db, 'coupons', appliedCoupon.id);
              const cDoc = await transaction.get(couponRef);
              if (cDoc.exists()) {
                transaction.update(couponRef, { usedCount: (cDoc.data().usedCount || 0) + 1 });
              }
            }
            
            for (const update of productUpdates) {`);

      content = content.replace(/setCart\(\[\]\);/g, "setCart([]);\n          setAppliedCoupon(null);\n          setCouponCodeInput('');\n          setCouponSuccess('');\n          setCouponError('');");
  } else {
      content = content.replace(/totalAmount: totalAmount,([\s\S]*?)status: status,/, "totalAmount: totalAmount,\n              discountAmount: discountAmount || 0,\n              couponId: appliedCoupon?.id || null,\n              couponCode: appliedCoupon?.code || null,\n$1status: status,");

      content = content.replace(/const paymentRef = doc\(collection\(db/g, `if (appliedCoupon) {
              const couponRef = doc(db, 'coupons', appliedCoupon.id);
              const cDoc = await transaction.get(couponRef);
              if (cDoc.exists()) {
                transaction.update(couponRef, { usedCount: (cDoc.data().usedCount || 0) + 1 });
              }
            }
            
            const paymentRef = doc(collection(db`);

      content = content.replace(/setCartItems\(\[\]\);/g, "setCartItems([]);\n          setAppliedCoupon(null);\n          setCouponCodeInput('');\n          setCouponSuccess('');\n          setCouponError('');");
  }

  // 5. Update UI in Modal
  const couponUI = `
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <div className="bg-gray-50/50 p-4 border border-gray-100 rounded-xl space-y-3">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Kupon Diskon (Opsional)</label>
                    <div className="flex gap-2">
                       <input
                          type="text"
                          placeholder="Masukkan kode kupon"
                          value={couponCodeInput}
                          onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                          disabled={!!appliedCoupon || isLoadingCoupon}
                          className="flex-1 px-4 py-2 border border-gray-200 bg-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                       />
                       {!appliedCoupon ? (
                         <button onClick={(e) => { e.preventDefault(); handleApplyCoupon(); }} disabled={isLoadingCoupon || !couponCodeInput} className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold w-24">Pasang</button>
                       ) : (
                         <button onClick={(e) => { e.preventDefault(); setAppliedCoupon(null); setCouponSuccess(''); setCouponError(''); setCouponCodeInput(''); }} className="px-4 py-2 bg-red-100 text-red-600 rounded-xl text-sm font-bold w-24">Hapus</button>
                       )}
                    </div>
                    {couponError && <p className="text-xs text-red-500 font-bold">{couponError}</p>}
                    {couponSuccess && <p className="text-xs text-green-500 font-bold">{couponSuccess}</p>}
                    {appliedCoupon && (
                      <div className="text-sm font-bold text-green-600">Diskon: - Rp {discountAmount.toLocaleString()}</div>
                    )}
                  </div>
                </div>
  `;

  if (!isV1) {
     content = content.replace(/(<div className="p-6 border-t border-gray-100 bg-gray-50">[\s\S]*?)<div className="flex justify-between items-center mb-6">/, "$1" + couponUI + "\n                <div className=\"flex justify-between items-center gap-4 mb-4 mt-6 text-sm font-bold text-gray-500\"><span className=\"uppercase\">Subtotal</span><span>Rp.{subtotal.toLocaleString()}</span></div>\n                " + "\n                <div className=\"flex justify-between items-center mb-6\">");
     content = content.replace(/Total Tagihan<\/span>/, "Total Tagihan</span>\n                  {appliedCoupon && <span className=\"text-sm text-green-500 font-bold ml-2\">(Telah Dipotong Diskon)</span>}");
  } else {
     content = content.replace(/(<div className="flex justify-between items-center mb-8">)/, couponUI + "\n                <div className=\"flex justify-between items-center gap-4 py-4 text-sm font-bold text-gray-500 border-t border-gray-100\"><span className=\"uppercase\">Subtotal</span><span>Rp {subtotal.toLocaleString()}</span></div>\n                " + "$1");
      content = content.replace(/Total Bayar<\/span>/, "Total Bayar</span>\n                  {appliedCoupon && <span className=\"text-sm text-green-500 font-bold ml-2\">(Telah Dipotong Diskon)</span>}");
  }

  // Write file
  fs.writeFileSync(filePath, content);
  console.log('Updated', filePath);
}

applyCouponLogic('src/pages/SalesOrder.tsx', false);
applyCouponLogic('src/pages/Sales.tsx', false);
applyCouponLogic('src/pages/SalesOrderV1.tsx', true);

