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

const inputRegex = /<input([^>]*?)className="([^"]+)"/g;
const selectRegex = /<select([^>]*?)className="([^"]+)"/g;
const textareaRegex = /<textarea([^>]*?)className="([^"]+)"/g;
const labelRegex = /<label([^>]*?)className="([^"]+)"/g;

function applyClasses(filePath) {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    function modifyInputSelectTextareaClass(match, attr1, currentClass) {
        let newClass = currentClass
            .replace(/px-5 py-4/g, 'p-2')
            .replace(/px-5 py-3/g, 'p-2')
            .replace(/px-4 py-4/g, 'p-2')
            .replace(/px-4 py-3/g, 'p-2')
            .replace(/px-4 py-2/g, 'p-2')
            .replace(/px-3 py-2/g, 'p-2')
            .replace(/p-4/g, 'p-2')
            .replace(/p-3/g, 'p-2')
            .replace(/py-4/g, 'p-2')
            .replace(/py-3/g, 'p-2')
            // Don't just blindly replace all rounded, but inside inputs it's okay
            .replace(/rounded-2xl/g, 'rounded-lg')
            .replace(/rounded-xl/g, 'rounded-lg')
            .replace(/rounded-md/g, 'rounded-lg')
            .replace(/rounded-3xl/g, 'rounded-lg')
            // Font and border fixes
            .replace(/bg-gray-50/g, 'bg-white')
            .replace(/border-none/g, 'border border-gray-200')
            .replace(/font-black/g, 'font-medium')
            .replace(/font-bold/g, 'font-medium')
            .replace(/font-semibold/g, 'font-medium');

        // Add standard classes if missing
        if (!newClass.includes('p-2')) {
            newClass += ' p-2';
        }
        if (!newClass.includes('rounded-')) {
            newClass += ' rounded-lg';
        }
        if (!newClass.includes('border')) {
             newClass += ' border border-gray-200';
        }
        if (!newClass.includes('text-')) {
             newClass += ' text-sm';
        }

        // Condese multiple spaces
        newClass = newClass.replace(/\s+/g, ' ').trim();

        // Clean redundant border
        newClass = newClass.replace(/border border-gray-100 border border-gray-200/g, 'border border-gray-200');
        newClass = newClass.replace(/border border-gray-200 border border-gray-200/g, 'border border-gray-200');

        return `<${match.startsWith('<input') ? 'input' : (match.startsWith('<select') ? 'select' : 'textarea')}${attr1}className="${newClass}"`;
    }

    function modifyLabelClass(match, attr1, currentClass) {
        let newClass = currentClass
           .replace(/text-\[10px\]/g, 'text-xs')
           .replace(/font-black/g, 'font-semibold')
           .replace(/font-bold/g, 'font-semibold')
           .replace(/uppercase/g, '')
           .replace(/tracking-widest/g, '')
           .replace(/text-gray-400/g, 'text-gray-600')
           .replace(/text-gray-500/g, 'text-gray-600');
        
        // ensure missing classes
        if (!newClass.includes('text-xs') && !newClass.includes('text-sm')) {
             newClass += ' text-xs';
        }
        if (!newClass.includes('font-semibold') && !newClass.includes('font-medium')) {
             newClass += ' font-semibold';
        }
        if (!newClass.includes('text-gray-')) {
             newClass += ' text-gray-600';
        }

        newClass = newClass.replace(/\s+/g, ' ').trim();
        return `<label${attr1}className="${newClass}"`;
    }

    content = content.replace(inputRegex, modifyInputSelectTextareaClass);
    content = content.replace(selectRegex, modifyInputSelectTextareaClass);
    content = content.replace(textareaRegex, modifyInputSelectTextareaClass);
    content = content.replace(labelRegex, modifyLabelClass);

    if (original !== content) {
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${filePath}`);
    }
}

// Ensure we fix across pages and components
walkDir('./src/pages', applyClasses);
walkDir('./src/components', applyClasses);
