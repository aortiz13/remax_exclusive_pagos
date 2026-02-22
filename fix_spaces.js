const fs = require('fs');
let text = fs.readFileSync('src/pages/ContractForm.jsx', 'utf8');

// Fix duplicate 'Plus' import. Line 3 has `Plus`, line 13 has `Plus`.
text = text.replace(/import \{ ArrowLeft, Building2, Key, Save, Plus, Trash2, UploadCloud, FilePlus, Search\} from 'lucide-react'/g, "import { ArrowLeft, Building2, Key, Save, Trash2 as Trash2Icon, UploadCloud, FilePlus, Search as SearchIcon} from 'lucide-react'");

// Replace the hallucinated spacing in interpolations and strings.
text = text.replace(/\{(\s*)[a-zA-Z0-9_\.]+(\s*)\}(\s*)_\s*/g, (match, p1, p2, p3) => {
    // Like `{ prefix } _` -> `{prefix}_`
    return match.replace(/\s/g, '');
});

// Fix specific template literal properties: [`${ prefix } _nombres`] -> [`${prefix}_nombres`]
text = text.replace(/\[\`\$\{\s*([a-zA-Z0-9_\(\)\.]+)\s*\}\s*_\s*([a-zA-Z0-9_]+)\s*\`\]/g, "[`${$1}_$2`]");

// Fix className spaces: `text - xs px - 2 py - 1`
text = text.replace(/text\s*-\s*xs/g, 'text-xs');
text = text.replace(/px\s*-\s*2/g, 'px-2');
text = text.replace(/py\s*-\s*1/g, 'py-1');
text = text.replace(/transition\s*-\s*colors/g, 'transition-colors');
text = text.replace(/bg\s*-\s*slate/g, 'bg-slate');
text = text.replace(/text\s*-\s*slate/g, 'text-slate');

// Fix the exact string literals hallucinated with space
text = text.replace(/\{\s*personType\s*===\s*'natural'\s*\?\s*'bg-slate-800 text-white'\s*:\s*'text-slate-500 hover:bg-slate-100'\s*\}/g, "{personType === 'natural' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}");
text = text.replace(/\{\s*personType\s*===\s*'juridica'\s*\?\s*'bg-slate-800 text-white'\s*:\s*'text-slate-500 hover:bg-slate-100'\s*\}/g, "{personType === 'juridica' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}");
text = text.replace(/\{\s*currency\s*===\s*'clp'\s*\?\s*'bg-slate-800 text-white'\s*:\s*'text-slate-500 hover:bg-slate-100'\s*\}/g, "{currency === 'clp' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}");
text = text.replace(/\{\s*currency\s*===\s*'uf'\s*\?\s*'bg-slate-800 text-white'\s*:\s*'text-slate-500 hover:bg-slate-100'\s*\}/g, "{currency === 'uf' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}");
text = text.replace(/\`\$\{\s*prefixRoot\s*\}\s*_\$\{\s*index\s*\+\s*1\s*\}\s*\`/g, "`${prefixRoot}_${index + 1}`");

fs.writeFileSync('src/pages/ContractForm.jsx', text);
console.log("Fixed syntax and spacing!");
