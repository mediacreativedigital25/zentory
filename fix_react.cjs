const fs = require('fs');

function fixReactError(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Change React.useMemo to useMemo
  content = content.replace(/React\.useMemo/g, 'useMemo');

  // Ensure useMemo is imported
  const importLines = content.split('\n').filter(line => line.startsWith('import ') && line.includes('react\''));
  if (importLines.length > 0) {
    const mainImport = importLines[0];
    if (mainImport.includes('{') && !mainImport.includes('useMemo')) {
       content = content.replace(mainImport, mainImport.replace('useState', 'useState, useMemo'));
    }
  }

  fs.writeFileSync(filePath, content);
}

fixReactError('src/pages/SalesOrder.tsx');
fixReactError('src/pages/Sales.tsx');
fixReactError('src/pages/SalesOrderV1.tsx');
