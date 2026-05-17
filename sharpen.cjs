const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./src', (filePath) => {
  if (filePath.endsWith('.tsx')) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let newContent = content
      .replace(/rounded-\[2\.5rem\]/g, 'rounded-md')
      .replace(/rounded-3xl/g, 'rounded-md')
      .replace(/rounded-2xl/g, 'rounded-md')
      .replace(/rounded-xl/g, 'rounded-md')
      .replace(/rounded-lg/g, 'rounded-md');
      
    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent, 'utf-8');
      console.log('Updated:', filePath);
    }
  }
});
