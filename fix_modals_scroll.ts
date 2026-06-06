import * as fs from 'fs';
import * as path from 'path';

function walkDir(dir: string, callback: (filepath: string) => void) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir('src/pages', function(filepath) {
  if (filepath.endsWith('.tsx') || filepath.endsWith('.ts')) {
    let content = fs.readFileSync(filepath, 'utf8');
    let hasChanges = false;

    // Find forms inside modals
    // Usually <form onSubmit=... className="p-6 space-y-X"> or similar
    // Let's add overflow-y-auto to form if it doesn't have it
    let newContent = content.replace(/(<form[^>]+className=")([^"]+)(")/g, (match, prefix, classes, suffix) => {
      // Don't add if already has overflow
      if (classes.includes('overflow-')) return match;
      if (!classes.includes('p-')) return match; // simple heuristic for main forms
      return `${prefix}${classes} flex-1 overflow-y-auto auto-rows-max${suffix}`;
    });
    
    // Also consider div bodies if no form tag is used, e.g. <div className="p-6 space-y-4"> just under the header
    newContent = newContent.replace(/(<div className="p-[0-9]+ space-y-[0-9]+")(?![^>]*overflow)/g, "$1 flex-1 overflow-y-auto auto-rows-max");

    if (content !== newContent) {
      fs.writeFileSync(filepath, newContent, 'utf8');
      console.log('Fixed scroll in: ' + filepath);
      hasChanges = true;
    }
  }
});
