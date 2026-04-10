import React, { useState, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  maxSizeMB?: number;
  folder?: string;
  className?: string;
  compact?: boolean;
}

export default function ImageUpload({ 
  value, 
  onChange, 
  label = "Upload Foto", 
  maxSizeMB = 1,
  folder = "uploads",
  className = "",
  compact = false
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset error
    setError(null);

    // Validate size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`Ukuran file maksimal ${maxSizeMB}MB`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate type
    if (!file.type.startsWith('image/')) {
      setError('File harus berupa gambar');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storageRef = ref(storage, `${folder}/${fileName}`);
      
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      
      onChange(url);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Gagal mengupload gambar. Silakan coba lagi.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = () => {
    onChange('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && !compact && (
        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
          {label}
        </label>
      )}
      
      <div className="relative">
        {/* Loading Overlay */}
        {isUploading && (
          <div className="absolute inset-0 z-20 bg-white/90 backdrop-blur-[2px] rounded-xl flex flex-col items-center justify-center gap-2 border border-indigo-100 shadow-inner">
            <Loader2 className={`${compact ? 'w-5 h-5' : 'w-8 h-8'} text-indigo-600 animate-spin`} />
            {!compact && (
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest animate-pulse">
                Mengupload...
              </span>
            )}
          </div>
        )}

        {value ? (
          <div className={`relative group ${compact ? 'h-12 w-12' : 'h-24 w-full'} rounded-xl overflow-hidden border border-gray-100 shadow-sm`}>
            <img 
              src={value} 
              alt="Preview" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            {!isUploading && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  type="button"
                  onClick={removeImage}
                  className={`${compact ? 'p-1' : 'p-1.5'} bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors`}
                >
                  <X className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={`w-full ${compact ? 'h-12 w-12' : 'h-24'} rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className={`${compact ? 'p-1' : 'p-2'} bg-gray-50 text-gray-400 rounded-full group-hover:text-indigo-600 transition-colors`}>
              <Upload className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
            </div>
            {!compact && (
              <div className="text-center">
                <span className="text-[10px] font-bold text-gray-500 block leading-tight">Klik untuk upload</span>
                <span className="text-[8px] text-gray-400 block mt-0.5">Maks {maxSizeMB}MB</span>
              </div>
            )}
          </button>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />
      </div>

      {error && (
        <p className="text-[10px] font-bold text-red-500 ml-1 flex items-center gap-1">
          <X className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}
