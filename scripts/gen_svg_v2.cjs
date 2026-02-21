const fs = require('fs');

const innerSize = 500;
const targetLength = innerSize * (194 / 200);
const numDots = 7;
const wrapperSize = targetLength / numDots;
const dotSize = wrapperSize * 0.93;
const delaySpan = 0.75;
const ANIM_DURATION = 1.5;

const bgColor = '#064b33';
const frontColor = '#09c972';
const backColor = 'rgba(9, 201, 114, 0.4)';

// In JS, we snapshot at t=0
const timeProgress = 0.5; // Let's use 0.5 to get a nice twisting shape instead of 0 which might look flat

let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${innerSize} ${innerSize}">
  <rect width="${innerSize}" height="${innerSize}" rx="${innerSize / 2}" fill="${bgColor}" />
  <g transform="translate(${innerSize / 2}, ${innerSize / 2}) rotate(-45) scale(0.93)">
`;

const dots = [];
const H = innerSize - dotSize; // max travel distance for centers

for (let i = 0; i < numDots; i++) {
    const delaySec = -(i / (numDots - 1)) * delaySpan;
    const absTime = timeProgress - delaySec;
    const progress = (((absTime % ANIM_DURATION) + ANIM_DURATION) % ANIM_DURATION) / ANIM_DURATION;
    const cosVal = Math.cos(progress * 2 * Math.PI);

    // Centers
    const x = (-targetLength / 2) + i * wrapperSize + (wrapperSize / 2);

    const yFront = -(H / 2) * cosVal;
    const scale1 = 0.75 + 0.25 * cosVal;

    const yBack = (H / 2) * cosVal;
    const scale2 = 0.75 - 0.25 * cosVal;

    dots.push({
        x: x,
        y: yBack,
        r: (dotSize / 2) * scale2,
        fill: backColor,
        z: -cosVal
    });

    dots.push({
        x: x,
        y: yFront,
        r: (dotSize / 2) * scale1,
        fill: frontColor,
        z: cosVal
    });
}

// Sort by z-index
dots.sort((a, b) => a.z - b.z).forEach(d => {
    svg += `    <circle cx="${d.x}" cy="${d.y}" r="${d.r}" fill="${d.fill}" />\n`;
});

svg += `  </g>\n</svg>`;

fs.writeFileSync('public/favicon.svg', svg);
fs.writeFileSync('public/mask-icon.svg', svg);
fs.writeFileSync('public/logopassagene.svg', svg);
console.log('SVGs exactly matching the React component generated.');
