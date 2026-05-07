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

function processClasses(classNameStr, isLabel = false) {
    let classes = classNameStr.split(/\s+/).filter(Boolean);
    
    if (isLabel) {
        // Remove bad typography
        classes = classes.filter(c => !c.startsWith('text-[') && c !== 'text-sm' && c !== 'text-xs' && !c.startsWith('font-') && c !== 'uppercase' && c !== 'tracking-widest' && !c.startsWith('text-gray-'));
        classes.push('text-xs', 'font-semibold', 'text-gray-600');
        // if there's no mb, add mb-1? The user just wanted standard. We'll leave spacing.
    } else {
        // Inputs, Selects, Textareas
        let hasPl = classes.some(c => c.startsWith('pl-'));
        let plClass = classes.find(c => c.startsWith('pl-'));

        // Remove paddings
        classes = classes.filter(c => !c.match(/^p[xytrbl]?-\d+(\.\d+)?$/) && !c.match(/^p-\d/));
        // Remove bg
        classes = classes.filter(c => !c.startsWith('bg-') || c === 'bg-white'); 
        // Remove rounded
        classes = classes.filter(c => !c.startsWith('rounded-'));
        // Remove borders
        classes = classes.filter(c => !c.startsWith('border-') && c !== 'border');
        // Remove text size/weight
        classes = classes.filter(c => c !== 'text-xs' && c !== 'text-sm' && c !== 'text-base' && !c.startsWith('font-'));

        // Add standard classes
        classes.push('p-2', 'bg-white', 'border', 'border-gray-200', 'rounded-lg', 'text-sm', 'font-medium');
        
        if (hasPl) {
            // Restore pl-10 if it had padding left (for icons)
            classes.push(plClass === 'pl-11' || plClass === 'pl-12' ? 'pl-10' : plClass);
        }
        
        // Remove duplicates
        classes = [...new Set(classes)];
    }
    
    return classes.join(' ');
}

// Ensure the regex captures the full element content so we only target elements that are primarily fields, 
// though the regexes below usually match just the opening tag which is what we want.
const elementRegex = /<(input|select|textarea)([^>]*?)className=(['"])(.*?)\3([^>]*)>/g;
const labelRegex = /<label([^>]*?)className=(['"])(.*?)\2([^>]*)>/g;

function applyClasses(filePath) {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    content = content.replace(elementRegex, (match, tag, before, quote, classNameStr, after) => {
        // Exception: Checkboxes, Radios, Hidden
        if (match.includes('type="checkbox"') || match.includes('type="radio"') || match.includes('type="hidden"')) {
            return match;
        }
        // If it's a search input inside some header it might not be a standard form field, but ok.
        let newClass = processClasses(classNameStr, false);
        // Special case: if readOnly or disabled was in text-gray-400, preserve it (complex, skip for now, but background can be gray-50)
        if (match.includes('readOnly') || match.includes('disabled')) {
             newClass = newClass.replace('bg-white', 'bg-gray-50');
        }
        return `<${tag}${before}className="${newClass}"${after}>`;
    });

    content = content.replace(labelRegex, (match, before, quote, classNameStr, after) => {
        let newClass = processClasses(classNameStr, true);
        return `<label${before}className="${newClass}"${after}>`;
    });

    if (original !== content) {
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${filePath}`);
    }
}

walkDir('./src/pages', applyClasses);
walkDir('./src/components', applyClasses);
