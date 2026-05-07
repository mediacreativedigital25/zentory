const fs = require('fs');
const filePath = 'src/pages/SalesOrderV1.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Clean up duplicate borders
content = content.replace(/border border-gray-200 border-none/g, 'border border-gray-200');
content = content.replace(/border border-gray-200 border border-gray-200/g, 'border border-gray-200');
content = content.replace(/border border-gray-200 border border-dashed border-gray-200/g, 'border border-dashed border-gray-200');
content = content.replace(/bg-white border border-gray-200 border border-dashed border-gray-200/g, 'bg-gray-50 border border-dashed border-gray-200');

// specifically for the product search box
content = content.replace(/className="w-full pl-10 pr-2 py-2 bg-gray-50 border-none rounded-lg/g, 'className="w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-lg');

// Ensure font-bold -> font-medium on other fields too.
content = content.replace(/font-bold/g, 'font-medium');
// Wait, I might break some other bold text like Total Amount. Total amount was font-black which became font-semibold, which is good.

// Re-read file to avoid missing stuff
fs.writeFileSync(filePath, content);
