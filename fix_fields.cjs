const fs = require('fs');
const filePath = 'src/pages/SalesOrderV1.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Replace padding
content = content.replace(/px-5 py-4/g, 'p-2');
content = content.replace(/px-5 py-3/g, 'p-2');
content = content.replace(/pl-12 pr-4 py-4/g, 'pl-10 pr-2 py-2');

// Fields are usually inputs/selects/textareas. Let's target the class strings of inputs
const inputRegex = /<input[^>]+className="([^"]+)"/g;
const selectRegex = /<select[^>]+className="([^"]+)"/g;
const textareaRegex = /<textarea[^>]+className="([^"]+)"/g;

function modifyClass(match, currentClass) {
    let newClass = currentClass
        .replace(/p-2.5/g, 'p-2')
        .replace(/px-3 py-2/g, 'p-2')
        .replace(/p-4/g, 'p-2') // For textarea
        .replace(/rounded-2xl/g, 'rounded-md')
        .replace(/rounded-xl/g, 'rounded-md')
        .replace(/rounded-lg/g, 'rounded-md')
        .replace(/font-bold/g, 'font-medium')
        .replace(/font-black/g, 'font-semibold')
        .replace(/border-none/g, 'border border-gray-200');
    return match.replace(currentClass, newClass);
}

content = content.replace(inputRegex, modifyClass);
content = content.replace(selectRegex, modifyClass);
content = content.replace(textareaRegex, modifyClass);

// Also fix div masquerading as inputs
const divInputRegex = /className="(w-full [^"]*px-5 py-4[^"]*)"/g;
content = content.replace(divInputRegex, (match, currentClass) => {
    let newClass = currentClass
        .replace(/px-5 py-4/g, 'p-2')
        .replace(/rounded-2xl/g, 'rounded-md');
    return `className="${newClass}"`;
});

// Update Labels
content = content.replace(/text-\[10px\] font-black text-gray-400 uppercase tracking-widest/g, 'text-xs font-semibold text-gray-600 mb-1');

// Update font sizes
content = content.replace(/text-sm font-bold/g, 'text-sm font-medium');
content = content.replace(/text-sm font-black/g, 'text-sm font-semibold');

fs.writeFileSync(filePath, content);
