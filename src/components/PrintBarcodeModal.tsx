import React, { useRef } from 'react';
import Barcode from 'react-barcode';
import { X, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PrintBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: { name: string; barcode: string }[];
}

export default function PrintBarcodeModal({ isOpen, onClose, products }: PrintBarcodeModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Barcode Labels</title>
          <style>
            @page {
              margin: 0;
            }
            body {
              margin: 0;
              padding: 10px;
              font-family: sans-serif;
            }
            .labels-container {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
              gap: 20px;
              justify-items: center;
            }
            .label {
              text-align: center;
              padding: 10px;
              border: 1px solid #eee;
              width: 160px;
              page-break-inside: avoid;
            }
            .product-name {
              font-weight: bold;
              margin-bottom: 5px;
              font-size: 10px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            @media print {
              .label { border: 0.5px solid #ccc; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="labels-container">
            ${printContent.innerHTML}
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-md shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5" />
                <h3 className="font-bold">Cetak Label Barcode ({products.length})</h3>
              </div>
              <button 
                onClick={onClose}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="text-center mb-6">
                <p className="text-sm text-gray-500">Pratinjau Label yang akan dicetak</p>
              </div>

              <div ref={printRef} className="grid grid-cols-2 sm:grid-cols-3 gap-4 justify-items-center">
                {products.map((product, idx) => (
                  <div key={idx} className="label border border-gray-100 p-3 rounded-md flex flex-col items-center w-full max-w-[160px]">
                    <div className="product-name text-[10px] font-bold mb-1 truncate w-full text-center">
                      {product.name}
                    </div>
                    <Barcode 
                      value={product.barcode} 
                      width={1.2} 
                      height={40} 
                      fontSize={10}
                      background="#ffffff"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 bg-gray-50 flex gap-3 border-t border-gray-100">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-white border border-gray-200 rounded-md text-gray-600 font-medium hover:bg-gray-100 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-md font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Cetak {products.length} Label
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
