const { createCanvas } = require('canvas');
const fs = require('fs');

const GOLD = '#D4A017';
const BG = '#111111';

function drawIcon(canvas, size) {
  const ctx = canvas.getContext('2d');
  const scale = size / 1024;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, size, size);

  const padding = size * 0.2;
  const iconSize = size - padding * 2;
  const offsetX = padding;
  const offsetY = padding;
  const s = iconSize / 24;

  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2 * s;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'none';

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(s, s);

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

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${size * 0.12}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('Vula', size * 0.43, size * 0.88);
  ctx.fillStyle = GOLD;
  ctx.fillText('24', size * 0.67, size * 0.88);
}

function generateIcon(outputPath, size) {
  const canvas = createCanvas(size, size);
  drawIcon(canvas, size);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Created: ${outputPath}`);
}

function generateAdaptiveIcon(outputPath, size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, size, size);

  const safeSize = size * 0.66;
  const offset = (size - safeSize) / 2;
  const s = safeSize / 24;

  ctx.strokeStyle = '#D4A017';
  ctx.lineWidth = 2 * s;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.save();
  ctx.translate(offset, offset);
  ctx.scale(s, s);

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

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Created: ${outputPath}`);
}

function generateSplash(outputPath) {
  const w = 1284;
  const h = 2778;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);

  const iconSize = 300;
  const iconX = (w - iconSize) / 2;
  const iconY = h / 2 - iconSize / 2 - 60;

  const s = iconSize / 24;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2 * s;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.save();
  ctx.translate(iconX, iconY);
  ctx.scale(s, s);

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

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 80px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Vula', w * 0.43, iconY + iconSize + 80);
  ctx.fillStyle = GOLD;
  ctx.fillText('24', w * 0.67, iconY + iconSize + 80);

  ctx.fillStyle = '#888888';
  ctx.font = '36px sans-serif';
  ctx.fillText('Emergency locksmith, 24/7', w / 2, iconY + iconSize + 140);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Created: ${outputPath}`);
}

const dirs = ['Vula24/assets', 'Vula24Pro/assets'];

dirs.forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

generateIcon('Vula24/assets/icon.png', 1024);
generateAdaptiveIcon('Vula24/assets/adaptive-icon.png', 1024);
generateIcon('Vula24Pro/assets/icon.png', 1024);
generateAdaptiveIcon('Vula24Pro/assets/adaptive-icon.png', 1024);
generateSplash('Vula24/assets/splash.png');
generateSplash('Vula24Pro/assets/splash.png');

console.log('All assets generated.');
