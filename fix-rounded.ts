import * as fs from 'fs';
import * as path from 'path';

function walkDir(dir: string, callback: (filepath: string) => void) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('src', function(filepath) {
  if (filepath.endsWith('.tsx') || filepath.endsWith('.ts')) {
    let content = fs.readFileSync(filepath, 'utf8');
    let newContent = content.replace(/rounded-\[3rem\]/g, 'rounded-xl')
                            .replace(/rounded-\[2rem\]/g, 'rounded-xl')
                            .replace(/rounded-\[32px\]/g, 'rounded-xl')
                            .replace(/rounded-\[28px\]/g, 'rounded-xl')
                            .replace(/rounded-\[24px\]/g, 'rounded-xl')
                            .replace(/rounded-3xl/g, 'rounded-xl')
                            .replace(/rounded-2xl/g, 'rounded-xl')
                            .replace(/rounded-t-xl/g, 'rounded-t-lg');
    if (content !== newContent) {
      fs.writeFileSync(filepath, newContent, 'utf8');
      console.log('Updated: ' + filepath);
    }
  }
});
