const fs = require('fs');
const filePath = 'src/pages/SalesOrderV1.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Ensure py-2.5 is py-2 everywhere
content = content.replace(/py-2\.5/g, 'py-2');
content = content.replace(/p-2\.5/g, 'p-2');

// Fix the typo on line 699 `font-black .5 py-0.5` which should be `px-1.5 py-0.5` maybe?
content = content.replace(/font-black \.5 py-0\.5/g, 'font-medium px-1.5 py-0.5');

// Make text-lg font-black in counters smaller to text-base font-semibold to be more standard, or just leave it.
// The user asked "Pada setiap Field all 8 px dan huruf menyesuaikan atau buatkan standard yg konsisten" meaning make font sizes consistent.
content = content.replace(/text-lg font-black text-gray-900/g, 'text-base font-semibold text-gray-900');

fs.writeFileSync(filePath, content);
