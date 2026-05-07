const fs = require('fs');
const filePath = 'src/pages/SalesOrderV1.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// The user asked for "8 px". In tailwind p-2 is `0.5rem` = 8px.
content = content.replace(/p-2\.5/g, 'p-2');

// Make sure rounded is also 8px (rounded-lg is 0.5rem = 8px)
content = content.replace(/rounded-md/g, 'rounded-lg');
content = content.replace(/rounded-xl/g, 'rounded-lg');

// ensure inputs are `h-10` max, or let padding determine the height. `p-2` is 8px.
fs.writeFileSync(filePath, content);
