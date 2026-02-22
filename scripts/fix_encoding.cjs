const fs = require('fs');
const files = [
    'src/pages/TransferenciaEmbrioes.tsx',
    'src/pages/Sexagem.tsx',
    'src/pages/DiagnosticoGestacao.tsx'
];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const buf = fs.readFileSync(file);
    if (buf.indexOf(0x00) !== -1) {
        let text = buf.toString('utf16le');
        if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
        fs.writeFileSync(file, text, 'utf8');
        console.log('Fixed encoding for', file);
    } else {
        console.log('Already utf-8:', file);
    }
}
