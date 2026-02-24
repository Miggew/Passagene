const sharp = require('sharp');
const fs = require('fs');

async function generateIcons() {
    const inputFile = 'public/favicon.svg';

    const sizes = [
        { size: 180, name: 'public/apple-touch-icon.png' },
        { size: 192, name: 'public/pwa-192x192.png' },
        { size: 512, name: 'public/pwa-512x512.png' },
        { size: 32, name: 'public/favicon.png' },
    ];

    for (const item of sizes) {
        await sharp(inputFile)
            .resize(item.size, item.size)
            .png()
            .toFile(item.name);
        console.log(`Generated ${item.name}`);
    }
}

generateIcons().catch(console.error);
