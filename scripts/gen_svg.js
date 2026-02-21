const fs = require('fs');
const numDots = 7;
const delaySpan = 0.75;
const dotSize = 35;

let str = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">\n';
str += '  <circle cx="250" cy="250" r="250" fill="#062e1c"/>\n';
str += '  <g transform="translate(250, 250) rotate(-45) translate(-150, 0)">\n';

const dots = [];
for (let i = 0; i < numDots; i++) {
    const progress = (i / (numDots - 1)) * delaySpan;
    const cosVal = Math.cos(progress * 2 * Math.PI);
    const topY = -50 * cosVal;
    const botY = 50 * cosVal;
    const scale1 = 0.75 + 0.25 * cosVal;
    const scale2 = 0.75 - 0.25 * cosVal;

    // Push back dot (z-index lower)
    dots.push({ x: i * 50, y: botY, r: (dotSize / 2) * scale2, fill: 'rgba(9, 201, 114, 0.4)', z: -cosVal });
    // Push front dot
    dots.push({ x: i * 50, y: topY, r: (dotSize / 2) * scale1, fill: '#09c972', z: cosVal });
}

// Sort by Z index to draw back dots first
dots.sort((a, b) => a.z - b.z).forEach(d => {
    str += `    <circle cx="${d.x}" cy="${d.y}" r="${d.r}" fill="${d.fill}"/>\n`;
});

str += '  </g>\n';
str += '</svg>';

fs.writeFileSync('public/favicon.svg', str);
fs.writeFileSync('public/mask-icon.svg', str);
fs.writeFileSync('public/logopassagene.svg', str);
console.log('SVGs generated effectively.');
