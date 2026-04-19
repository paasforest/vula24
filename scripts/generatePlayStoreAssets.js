const { createCanvas } = require('canvas');
const fs = require('fs');

const GOLD = '#D4A017';
const BG = '#111111';
const WHITE = '#FFFFFF';
const MUTED = '#888888';

function generateFeatureGraphic() {
  const w = 1024;
  const h = 500;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = GOLD;
  ctx.globalAlpha = 0.06;
  ctx.lineWidth = 1;
  for (let i = 0; i < w; i += 40) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, h);
    ctx.stroke();
  }
  for (let i = 0; i < h; i += 40) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(w, i);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.beginPath();
  ctx.arc(750, 250, 300, 0, Math.PI * 2);
  ctx.fillStyle = GOLD;
  ctx.globalAlpha = 0.04;
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.beginPath();
  ctx.arc(750, 250, 200, 0, Math.PI * 2);
  ctx.fillStyle = GOLD;
  ctx.globalAlpha = 0.04;
  ctx.fill();
  ctx.globalAlpha = 1;

  const keyX = 80;
  const keyY = 170;
  const keyS = 14;

  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2 * keyS / 8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(keyX, keyY);
  ctx.scale(keyS, keyS);

  ctx.beginPath();
  ctx.moveTo(21, 2);
  ctx.lineTo(19, 4);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(11.3891, 11.6109);
  ctx.bezierCurveTo(12.3844, 12.6062, 13, 13.9812, 13, 15.5);
  ctx.bezierCurveTo(13, 18.5376, 10.5376, 21, 7.5, 21);
  ctx.bezierCurveTo(4.46243, 21, 2, 18.5376, 2, 15.5);
  ctx.bezierCurveTo(2, 12.4624, 4.46243, 10, 7.5, 10);
  ctx.bezierCurveTo(9.01878, 10, 10.3938, 10.6156, 11.3891, 11.6109);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(11.3891, 11.6109);
  ctx.lineTo(15.5, 7.5);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(15.5, 7.5);
  ctx.lineTo(18, 10);
  ctx.lineTo(21, 7);
  ctx.lineTo(18.5, 4.5);
  ctx.lineTo(15.5, 7.5);
  ctx.stroke();

  ctx.restore();

  ctx.font = 'bold 32px sans-serif';
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'left';
  ctx.fillText('Vula', keyX + (21 * keyS * 0.3), keyY + (21 * keyS) + 48);
  ctx.fillStyle = GOLD;
  ctx.fillText('24', keyX + (21 * keyS * 0.3) + 78, keyY + (21 * keyS) + 48);

  ctx.font = 'bold 72px sans-serif';
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'left';
  ctx.fillText('Emergency locksmith,', 80, 260);

  ctx.font = 'bold 72px sans-serif';
  ctx.fillStyle = '#F5C842';
  ctx.fillText('24/7.', 80, 340);

  ctx.font = '28px sans-serif';
  ctx.fillStyle = '#BBBBBB';
  ctx.fillText('Verified professionals. Fast response. Always on.', 80, 400);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('play-store-assets/feature-graphic.png', buffer);
  console.log('Created: play-store-assets/feature-graphic.png');
}

if (!fs.existsSync('play-store-assets')) {
  fs.mkdirSync('play-store-assets');
}

generateFeatureGraphic();
console.log('Play Store assets generated.');
