import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Save, Plus, Trash2, Building, Loader2, Image as ImageIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { BANKS } from '../../lib/banks';

export default function BankLogos() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bankLogos, setBankLogos] = useState<Record<string, string>>({});
  const [customBanks, setCustomBanks] = useState<{ id: string, name: string, url: string }[]>([]);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'config'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.bankLogos) {
          const loadedBankLogos: Record<string, string> = {};
          const loadedCustomBanks: { id: string, name: string, url: string }[] = [];
          
          Object.entries(data.bankLogos).forEach(([key, value]) => {
            if (typeof value === 'string') {
              if (BANKS.includes(key)) {
                loadedBankLogos[key] = value;
              } else {
                loadedCustomBanks.push({ id: Date.now().toString() + Math.random(), name: key, url: value });
              }
            }
          });
          setBankLogos(loadedBankLogos);
          setCustomBanks(loadedCustomBanks);
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleBankLogoChange = (bankName: string, url: string) => {
    setBankLogos(prev => ({ ...prev, [bankName]: url }));
  };

  const handleCustomBankChange = (index: number, field: 'name' | 'url', value: string) => {
    const newCustom = [...customBanks];
    newCustom[index][field] = value;
    setCustomBanks(newCustom);
  };

  const addCustomBank = () => {
    setCustomBanks([...customBanks, { id: Date.now().toString(), name: '', url: '' }]);
  };

  const removeCustomBank = (index: number) => {
    setCustomBanks(customBanks.filter((_, i) => i !== index));
  };

  const handeSave = async () => {
    setSaving(true);
    setSaveMessage('');
    try {
      const mergedLogos: Record<string, string> = { ...bankLogos };
      customBanks.forEach(b => {
        if (b.name && b.name.trim() !== '') {
          mergedLogos[b.name.trim()] = b.url;
        }
      });
      
      await setDoc(doc(db, 'system', 'config'), {
        bankLogos: mergedLogos
      }, { merge: true });
      
      setSaveMessage('Logo bank berhasil disimpan!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err: any) {
      console.error("Gagal update config:", err);
      setSaveMessage('Gagal menyimpan logo: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Manajemen Logo Bank & E-Wallet</h2>
          <p className="text-gray-500">Kumpulkan semua logo bank berdasarkan URL untuk global setting.</p>
        </div>
      </div>

      <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
         <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Building className="w-5 h-5 text-indigo-600" />
              Standard Banks & E-Wallets
            </h3>
         </div>
         <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
           {BANKS.filter(b => b !== 'Lainnya').map(bank => (
             <div key={bank} className="flex gap-4 p-4 border border-gray-100 rounded-lg shadow-sm bg-gray-50 items-center">
               <div className="w-16 h-16 bg-white shrink-0 border border-gray-200 rounded-lg flex items-center justify-center p-1 overflow-hidden">
                 {bankLogos[bank] ? (
                   <img src={bankLogos[bank]} alt={bank} className="w-full h-full object-contain" />
                 ) : (
                   <ImageIcon className="w-6 h-6 text-gray-300" />
                 )}
               </div>
               <div className="flex-1 space-y-1">
                 <label className="text-xs font-semibold text-gray-800">{bank}</label>
                 <input
                    type="text"
                    value={bankLogos[bank] || ''}
                    onChange={(e) => handleBankLogoChange(bank, e.target.value)}
                    placeholder="URL Logo (https://...)"
                    className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                 />
               </div>
             </div>
           ))}
         </div>
      </div>

      <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
         <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Building className="w-5 h-5 text-indigo-600" />
              Custom Banks / E-Wallets
            </h3>
         </div>
         <div className="p-6 space-y-4">
           {customBanks.map((customBank, index) => (
             <div key={customBank.id} className="flex flex-col sm:flex-row gap-4 p-4 border border-gray-100 rounded-lg shadow-sm bg-gray-50 items-start sm:items-center relative">
               <div className="absolute right-2 top-2">
                 <button onClick={() => removeCustomBank(index)} className="p-1 text-red-500 hover:text-red-700 bg-white rounded-md shadow-sm border border-red-100">
                   <Trash2 className="w-4 h-4" />
                 </button>
               </div>
               <div className="w-16 h-16 bg-white shrink-0 border border-gray-200 rounded-lg flex items-center justify-center p-1 overflow-hidden">
                 {customBank.url ? (
                   <img src={customBank.url} alt={customBank.name || 'custom'} className="w-full h-full object-contain" />
                 ) : (
                   <ImageIcon className="w-6 h-6 text-gray-300" />
                 )}
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 w-full pt-4 sm:pt-0">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-800">Nama Bank / E-Wallet</label>
                    <input
                        type="text"
                        value={customBank.name}
                        onChange={(e) => handleCustomBankChange(index, 'name', e.target.value)}
                        placeholder="Contoh: Bank BJB"
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-800">URL Logo</label>
                    <input
                        type="text"
                        value={customBank.url}
                        onChange={(e) => handleCustomBankChange(index, 'url', e.target.value)}
                        placeholder="URL Logo (https://...)"
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
               </div>
             </div>
           ))}

           <button
             onClick={addCustomBank}
             className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm font-semibold text-gray-600 hover:text-indigo-600 hover:border-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
           >
             <Plus className="w-4 h-4" />
             Tambah Custom Bank
           </button>
         </div>
      </div>

      <div className="flex items-center justify-end space-x-4">
        {saveMessage && (
          <span className={`text-sm font-semibold ${saveMessage.includes('Gagal') ? 'text-red-500' : 'text-green-600'}`}>
            {saveMessage}
          </span>
        )}
        <button
          onClick={handeSave}
          disabled={saving}
          className="px-8 py-3 bg-indigo-600 text-white rounded-md font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Menyimpan...
            </>
          ) : (
            <>
              <Save className="w-5 h-5 mr-2" />
              Simpan Perubahan
            </>
          )}
        </button>
      </div>

    </div>
  );
}
