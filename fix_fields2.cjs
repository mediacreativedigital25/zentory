const fs = require('fs');
const filePath = 'src/pages/SalesOrderV1.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Replace standard padding strings across the board inside classNames
content = content.replace(/px-5 py-4/g, 'p-2');
content = content.replace(/px-5 py-3/g, 'p-2');
content = content.replace(/p-4/g, 'p-2'); // this might affect other paddings too. Let's be careful.
content = content.replace(/w-full p-4/g, 'w-full p-2.5'); // textarea

// Specifically targeting input, select, textarea class patterns:
const classPatterns = [
  { from: 'className="w-full p-2 bg-gray-50 border-none rounded-2xl text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-sans"', to: 'className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-sans"' },
  { from: 'className="w-full p-2 bg-gray-50 border-none rounded-2xl text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all uppercase"', to: 'className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all uppercase"' },
  { from: 'className="w-full p-2 bg-gray-100 border-none rounded-2xl text-sm font-medium text-gray-400 outline-none cursor-not-allowed uppercase"', to: 'className="w-full p-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium text-gray-400 outline-none cursor-not-allowed uppercase"' },
  { from: 'className="w-full p-2 bg-gray-100 border-none rounded-2xl text-sm font-medium text-gray-400 outline-none cursor-not-allowed font-sans"', to: 'className="w-full p-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium text-gray-400 outline-none cursor-not-allowed font-sans"' },
  { from: 'className="w-full p-2 bg-indigo-50 border border-indigo-100 rounded-2xl text-sm font-medium text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-sans appearance-none cursor-pointer"', to: 'className="w-full p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg text-sm font-medium text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-sans appearance-none cursor-pointer"' },
  { from: 'className="w-full p-2 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium text-gray-700 resize-none h-[calc(100%-2rem)] min-h-[80px]"', to: 'className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium text-gray-700 resize-none h-full min-h-[80px]"' },
  { from: 'className="w-full p-2 bg-gray-100 border border-gray-200 rounded-xl text-xs font-medium text-gray-400 outline-none cursor-not-allowed font-sans"', to: 'className="w-full p-2.5 bg-gray-100 border border-gray-200 rounded-lg text-xs font-medium text-gray-400 outline-none cursor-not-allowed font-sans"' },
  { from: 'className="w-full p-2 bg-gray-50 border border-dashed border-gray-200 rounded-2xl text-[10px] font-medium text-gray-400 italic flex items-center justify-center"', to: 'className="w-full p-2.5 bg-gray-50 border border-dashed border-gray-200 rounded-lg text-xs font-medium text-gray-400 italic flex items-center justify-center"' },
  { from: 'className="w-full p-2 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-between"', to: 'className="w-full p-2.5 bg-orange-50 border border-orange-100 rounded-lg flex items-center justify-between"' },
  { from: 'className="w-full p-2 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between"', to: 'className="w-full p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center justify-between"' }
];

classPatterns.forEach(pattern => {
  content = content.replace(pattern.from, pattern.to);
});

// For Label text:
content = content.replace(/text-xs font-semibold text-gray-600 mb-1 flex items-center gap-2 px-1/g, 'text-xs font-semibold text-gray-600 mb-2 flex items-center gap-2');
content = content.replace(/px-1/g, ''); // Remove stray px-1 from labels

// General fallback if some didn't match:
content = content.replace(/w-full p-2 bg-gray-50/g, 'w-full p-2.5 bg-white border border-gray-200');
content = content.replace(/w-full p-2 bg-gray-100/g, 'w-full p-2.5 bg-gray-100 border border-gray-200');
content = content.replace(/rounded-2xl/g, 'rounded-lg');

fs.writeFileSync(filePath, content);
