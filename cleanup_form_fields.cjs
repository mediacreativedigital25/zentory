const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
    });
}

function applyStyles(filePath) {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    // Specific button and UI replacements for px-4 py-3/px-5 py-4 strings that acts like a form element or generic button
    // It is simpler to just replace any `px-4 py-3` and `px-5 py-4` with `p-2` when it's an input-like or button-like class.
    
    // We update all `className="..."` strings that look like buttons or inputs
    const classNameRegex = /className=(['"])(.*?)\1/g;
    content = content.replace(classNameRegex, (match, quote, classNameStr) => {
        let isInputLike = classNameStr.includes('border') && (classNameStr.includes('focus:ring') || classNameStr.includes('outline-none') || classNameStr.includes('hover:bg-') || classNameStr.includes('rounded-2xl') || classNameStr.includes('rounded-xl'));
        
        let newClass = classNameStr;
        if (isInputLike) {
            newClass = newClass
               .replace(/px-5 py-4/g, 'p-2')
               .replace(/px-4 py-3/g, 'p-2')
               .replace(/px-4 py-2/g, 'p-2');
               
            // Only convert rounded classes if they are in these input/button shapes
            newClass = newClass
               .replace(/rounded-2xl/g, 'rounded-lg')
               .replace(/rounded-xl/g, 'rounded-lg');
               
            // Replace generic bold fonts with medium
            newClass = newClass
               .replace(/font-black/g, 'font-medium')
               .replace(/font-bold/g, 'font-medium')
               .replace(/font-semibold/g, 'font-medium');
               
            // Change bg-gray-50 to bg-white
            if (newClass.includes('border') && !newClass.includes('bg-indigo') && !newClass.includes('bg-green') && !newClass.includes('bg-red')) {
               newClass = newClass.replace(/bg-gray-50/g, 'bg-white');
               // If there was border-none, make it border border-gray-200
               newClass = newClass.replace(/border-none/g, 'border border-gray-200');
            }
        }
        
        return match === `className=${quote}${newClass}${quote}` ? match : `className=${quote}${newClass}${quote}`;
    });

    if (original !== content) {
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${filePath}`);
    }
}

walkDir('./src/pages', applyStyles);
walkDir('./src/components', applyStyles);
