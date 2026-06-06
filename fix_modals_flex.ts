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

    // Check if there are modals with overflow-hidden but missing flex flex-col and max-h-[90vh]
    // Specifically target those with 'w-full max-w-... overflow-hidden'
    let newContent = content.replace(/className="(bg-white rounded-[^"]*shadow-[^"]*w-full max-w-[a-z0-9\-]+ overflow-hidden[^"]*)"/g, (match, p1) => {
      let replacement = p1;
      if (!replacement.includes('flex flex-col')) {
        replacement += ' flex flex-col';
      }
      if (!replacement.includes('max-h-')) {
        replacement += ' max-h-[90vh]';
      }
      return `className="${replacement.replace('overflow-hidden flex flex-col max-h-[90vh]', 'flex flex-col max-h-[90vh] overflow-hidden')}"`; // Just re-order safely
    });

    if (content !== newContent) {
      fs.writeFileSync(filepath, newContent, 'utf8');
      console.log('Fixed modal container in: ' + filepath);
      hasChanges = true;
    }

    // Now fix children: if they are <form> or <div> that hold content, make sure they have overflow-y-auto if they don't
    // Wait, it is safer to just rely on the existing overflow-y-auto, OR let's just use flex-1 overflow-y-auto on the form/body
    // Usually the body is right after the header. Let's find `<form className="p-` to `<form className="flex-1 overflow-y-auto p-`
    if (hasChanges) {
      // no-op for now unless we need more logic
    }
  }
});
