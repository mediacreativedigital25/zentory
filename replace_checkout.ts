import * as fs from 'fs';

const file = 'src/pages/marketplace/MarketplaceCheckout.tsx';
let content = fs.readFileSync(file, 'utf8');

const returnRegex = /return \(\s*<div className="min-h-screen bg-gray-50 flex flex-col font-sans">[\s\S]*?\);\n}\n$/g;

const newReturn = `return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center">
          <Link to={\`/\${getBasePath()}/\${tenantSlug}\`} className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold hidden sm:inline">Kembali ke Toko</span>
          </Link>
          <div className="flex-1 text-center font-bold text-lg text-gray-900">
            {tenant?.name || 'Checkout'}
          </div>
          <div className="w-8 sm:w-32" />
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentStep === 4 ? (
          <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-8 sm:p-12 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Pesanan Anda dengan nomor {orderId && <span className="font-bold text-indigo-600">#{orderId}</span>} telah diterima. 
            </p>

            {paymentMethod === 'manual' && tenant?.paymentMethods?.manual?.accounts && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-8 text-left max-w-xl mx-auto">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                  Informasi Pembayaran
                </h3>
                <p className="text-sm text-gray-600 mb-4">Silakan transfer sejumlah <strong className="text-indigo-600 text-lg">Rp {finalOrderTotal.toLocaleString('id-ID')}</strong> ke salah satu rekening berikut:</p>
                <div className="space-y-3">
                   {tenant.paymentMethods.manual.accounts.map((acc: any, idx: number) => (
                     <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-gray-900 text-lg">{acc.bankName}</p>
                          <p className="text-sm text-gray-500">a.n. {acc.accountHolder}</p>
                        </div>
                        <div className="text-right flex items-center justify-end gap-2">
                          <p className="font-mono font-bold text-gray-800 text-lg">{acc.accountNumber}</p>
                          <button
                            onClick={() => handleCopyAccount(acc.accountNumber)}
                            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-500 hover:text-indigo-600"
                            title="Salin Nomor Rekening"
                          >
                            {copiedAccount === acc.accountNumber ? (
                              <CheckCheck className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                     </div>
                   ))}
                </div>
                {(tenant?.settings?.phone || tenant?.phone) && (
                   <div className="mt-6 flex flex-col items-center">
                     <p className="text-sm text-gray-500 mb-3 text-center">Setelah melakukan transfer, silakan konfirmasi pesanan Anda via WhatsApp.</p>
                     <a 
                       href={\`https://wa.me/\${tenant?.settings?.phone || tenant?.phone}?text=\${encodeURIComponent(\`Halo \${tenant.name},\\nSaya telah melakukan pembayaran untuk pesanan nomor *\${orderId}* sebesar Rp \${finalOrderTotal.toLocaleString('id-ID')}.\\n\\nBerikut bukti transfernya:\`)}\`}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="inline-flex items-center gap-2 bg-green-500 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-green-600 transition-colors"
                     >
                       <MessageSquare className="w-4 h-4" />
                       Konfirmasi Pembayaran
                     </a>
                   </div>
                )}
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
               <Link 
                 to={\`/\${getBasePath()}/\${tenantSlug}\`}
                 className="bg-indigo-600 text-white font-bold px-8 py-3 rounded-lg hover:bg-indigo-700 transition-colors w-full sm:w-auto"
               >
                 Kembali Belanja
               </Link>
            </div>
          </div>
        ) : cart.length === 0 ? (
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
             <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingCart className="w-10 h-10 text-gray-400" />
             </div>
             <h2 className="text-2xl font-bold text-gray-900 mb-4">Keranjang Kosong</h2>
             <p className="text-gray-500 mb-8">Anda belum menambahkan produk ke dalam keranjang belanja.</p>
             <Link 
               to={\`/\${getBasePath()}/\${tenantSlug}\`}
               className="bg-indigo-600 text-white font-bold px-8 py-3 rounded-lg hover:bg-indigo-700 transition-colors inline-block"
             >
               Mulai Belanja
             </Link>
           </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 space-y-6">
              {/* Form Section */}
              <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-6">{isBookingTheme ? 'Detail Pemesan' : 'Detail Tagihan'}</h2>
                
                <div className="space-y-5">
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                     <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-1">{isBookingTheme ? 'Nama' : 'Nama Lengkap'} *</label>
                       <input 
                         type="text" 
                         required
                         value={addressData.name}
                         onChange={e => setAddressData({...addressData, name: e.target.value})}
                         className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500" 
                         placeholder="Misal: Budi Santoso"
                       />
                     </div>
                     <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-1">No. Handphone / WhatsApp *</label>
                       <input 
                         type="text" 
                         required
                         value={addressData.phone}
                         onChange={e => setAddressData({...addressData, phone: e.target.value})}
                         className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500" 
                         placeholder="Misal: 08123456789"
                       />
                     </div>
                   </div>
                   
                   {isBookingTheme && (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                       <div>
                         <label className="block text-sm font-semibold text-gray-700 mb-1">Tanggal Pelaksanaan *</label>
                         <input 
                           type="date" 
                           required
                           value={addressData.bookingDate || ''}
                           onChange={e => setAddressData({...addressData, bookingDate: e.target.value})}
                           className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white" 
                         />
                       </div>
                       <div>
                         <label className="block text-sm font-semibold text-gray-700 mb-1">Waktu Pelaksanaan *</label>
                         <input 
                           type="time" 
                           required
                           value={addressData.bookingTime || ''}
                           onChange={e => setAddressData({...addressData, bookingTime: e.target.value})}
                           className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white" 
                         />
                       </div>
                     </div>
                   )}

                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                     <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-1">Provinsi *</label>
                       <select
                         required
                         value={selectedProvinceId || (provinces.find(p => p.name === addressData.province)?.id || '')}
                         onChange={handleProvinceChange}
                         className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                       >
                         <option value="">Pilih Provinsi</option>
                         {provinces.map(p => (
                           <option key={p.id} value={p.id}>{p.name}</option>
                         ))}
                       </select>
                     </div>
                     <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-1">Kota / Kabupaten *</label>
                       <select
                         required
                         value={selectedCityId || (cities.find(c => c.name === addressData.city)?.id || '')}
                         onChange={handleCityChange}
                         className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                         disabled={!selectedProvinceId && !addressData.province}
                       >
                         <option value="">Pilih Kota/Kabupaten</option>
                         {cities.map(c => (
                           <option key={c.id} value={c.id}>{c.name}</option>
                         ))}
                       </select>
                     </div>
                   </div>

                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                     <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-1">Kecamatan *</label>
                       <select
                         required
                         value={selectedDistrictId || (districts.find(d => d.name === addressData.district)?.id || '')}
                         onChange={handleDistrictChange}
                         className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                         disabled={!selectedCityId && !addressData.city}
                       >
                         <option value="">Pilih Kecamatan</option>
                         {districts.map(d => (
                           <option key={d.id} value={d.id}>{d.name}</option>
                         ))}
                       </select>
                     </div>
                     <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-1">Desa / Kelurahan *</label>
                       <select
                         required
                         value={selectedVillageId || (villages.find(v => v.name === addressData.village)?.id || '')}
                         onChange={handleVillageChange}
                         className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                         disabled={!selectedDistrictId && !addressData.district}
                       >
                         <option value="">Pilih Desa/Kelurahan</option>
                         {villages.map(v => (
                           <option key={v.id} value={v.id}>{v.name}</option>
                         ))}
                       </select>
                     </div>
                   </div>
                   
                   <div>
                     <label className="block text-sm font-semibold text-gray-700 mb-1">{isBookingTheme ? 'Alamat Pelaksanaan' : 'Alamat Jalan'} *</label>
                     <textarea 
                       rows={3}
                       required
                       value={addressData.address}
                       onChange={e => setAddressData({...addressData, address: e.target.value})}
                       className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 resize-none" 
                       placeholder="Nama jalan, RT/RW, Patokan"
                     />
                   </div>

                   {!isBookingTheme && (
                     <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-1">Kode Pos</label>
                       <input 
                         type="text"
                         value={addressData.postalCode}
                         onChange={e => setAddressData({...addressData, postalCode: e.target.value})} 
                         className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500" 
                         placeholder="Misal: 12345"
                       />
                     </div>
                   )}

                   {isBookingTheme && (
                     <>
                       <div>
                         <label className="block text-sm font-semibold text-gray-700 mb-1">Share Location (URL/Link Google Maps) *</label>
                         <input 
                           type="url"
                           required
                           value={addressData.shareLocation || ''}
                           onChange={e => setAddressData({...addressData, shareLocation: e.target.value})} 
                           className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500" 
                           placeholder="https://maps.google.com/..."
                         />
                       </div>
                       <div>
                         <label className="block text-sm font-semibold text-gray-700 mb-1">Catatan Pesanan / Keterangan (Opsional)</label>
                         <textarea
                           rows={2}
                           value={(addressData as any).pack || ''}
                           onChange={e => setAddressData({...addressData, pack: e.target.value})} 
                           className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 resize-none" 
                           placeholder="Catatan untuk penjual"
                         />
                       </div>
                     </>
                   )}
                </div>
              </div>
            </div>
            
            {/* Right Sidebar: Order Summary & Payment */}
            <div className="w-full lg:w-96 xl:w-[400px] shrink-0 space-y-6">
               <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-6 border-b border-gray-100">
                    <h3 className="text-xl font-bold text-gray-900">Pesanan Anda</h3>
                  </div>

                  {/* Cart Items Summary */}
                  <div className="p-6 bg-gray-50/50 border-b border-gray-100">
                    <div className="space-y-4">
                      {cart.map(item => (
                        <div key={item.id} className="flex gap-4">
                           <div className="w-16 h-16 bg-white border border-gray-200 rounded-lg overflow-hidden shrink-0 flex items-center justify-center relative shadow-sm">
                              {item.product.image || item.product.imageUrl ? (
                                <img src={item.product.image || item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                              ) : (
                                <ShoppingCart className="w-6 h-6 text-gray-300" />
                              )}
                              <div className="absolute -top-2 -right-2 bg-indigo-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                                {item.quantity}
                              </div>
                           </div>
                           <div className="flex-1 min-w-0 flex flex-col justify-center">
                             <div className="flex justify-between items-start gap-2">
                               <h4 className="text-sm font-semibold text-gray-800 line-clamp-2">{item.product.name}</h4>
                             </div>
                             <div className="text-sm font-bold text-gray-900 mt-1">Rp {(item.product.price * item.quantity).toLocaleString('id-ID')}</div>
                           </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-200 space-y-3 font-semibold text-sm text-gray-600">
                       <div className="flex justify-between">
                         <span>Subtotal</span>
                         <span className="text-gray-900">Rp {cartTotal.toLocaleString('id-ID')}</span>
                       </div>
                       <div className="flex justify-between">
                         <span>Pengiriman</span>
                         <span className="text-gray-900 text-right">Sesuai Alamat</span>
                       </div>
                       <div className="flex justify-between text-lg font-bold text-indigo-700 pt-3 border-t border-gray-200">
                         <span>Total</span>
                         <span>Rp {cartTotal.toLocaleString('id-ID')}</span>
                       </div>
                       {isDownPaymentApplied && (
                         <div className="flex justify-between items-center text-sm font-bold text-indigo-700 bg-indigo-50 p-3 rounded-lg">
                           <span>Down Payment (DP)</span>
                           <span>Rp {paymentAmountToProcess.toLocaleString('id-ID')}</span>
                         </div>
                       )}
                    </div>
                  </div>

                  {/* Payment Options */}
                  <div className="p-6">
                     <h4 className="font-bold text-gray-900 mb-4">Metode Pembayaran</h4>
                     <div className="space-y-3">
                       <label className={\`border flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-colors \${paymentMethod === 'whatsapp' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}\`}>
                         <div className="pt-0.5">
                           <input 
                             type="radio" 
                             name="payment_method" 
                             className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-600" 
                             checked={paymentMethod === 'whatsapp'} 
                             onChange={() => setPaymentMethod('whatsapp')} 
                           />
                         </div>
                         <div>
                           <div className="font-semibold text-gray-900 text-sm">WhatsApp / Langsung</div>
                           {paymentMethod === 'whatsapp' && (
                             <div className="text-xs text-gray-500 mt-1">Selesaikan pesanan dan konfirmasi lewat chat WhatsApp dengan toko.</div>
                           )}
                         </div>
                       </label>

                       {tenant?.paymentMethods?.manual?.isEnabled && tenant?.paymentMethods?.manual?.accounts?.length > 0 && (
                         <label className={\`border flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-colors \${paymentMethod === 'manual' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}\`}>
                           <div className="pt-0.5">
                             <input 
                               type="radio" 
                               name="payment_method" 
                               className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-600" 
                               checked={paymentMethod === 'manual'} 
                               onChange={() => setPaymentMethod('manual')} 
                             />
                           </div>
                           <div>
                             <div className="font-semibold text-gray-900 text-sm">Transfer Bank Pribadi</div>
                             {paymentMethod === 'manual' && (
                               <div className="text-xs text-gray-500 mt-1">Lakukan transfer bank ke rekening yang dipilih di langkah berikutnya.</div>
                             )}
                           </div>
                         </label>
                       )}
                     </div>

                     <div className="mt-8 pt-6 border-t border-gray-100 text-xs text-gray-500 mb-6">
                       Data pribadi Anda akan digunakan untuk memproses pesanan Anda, mendukung pengalaman Anda di situs web ini, dan tujuan lain yang wajar.
                     </div>

                     <button 
                       onClick={() => {
                          if (!addressData.name || !addressData.phone || !addressData.address || !addressData.district || !addressData.village || !addressData.city || !addressData.province || (isBookingTheme && !addressData.shareLocation)) {
                             alert(isBookingTheme ? 'Mohon lengkapi seluruh field yang wajib diisi termasuk Link Google Maps.' : 'Mohon lengkapi seluruh field alamat yang wajib diisi.');
                             return;
                          }
                          handlePlaceOrder();
                       }}
                       disabled={isSubmitting || cart.length === 0}
                       className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 disabled:opacity-50 text-lg flex justify-center items-center gap-2"
                     >
                       {isSubmitting ? 'Memproses...' : 'Buat pesanan'}
                     </button>
                  </div>
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
`;

content = content.replace(returnRegex, newReturn);
fs.writeFileSync(file, content);
console.log('done replacing render');
