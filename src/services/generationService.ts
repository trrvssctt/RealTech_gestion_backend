// src/services/generationService.ts
import canvas from 'canvas'; // or pdfkit for better PDF to PNG
import fs from 'fs';
import path from 'path';

// Generate Facture PNG
export const generateFacturePNG = async (commande: any) => {
  // Use canvas to create image
  const { createCanvas } = canvas;
  const cvs = createCanvas(800, 600);
  const ctx = cvs.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 800, 600);
  ctx.fillStyle = 'black';
  ctx.font = '30px Arial';
  ctx.fillText(`Facture ${commande.code} - Total: ${commande.total_cmd}`, 100, 100);
  // Add more details...

  const date = new Date().toISOString().split('T')[0];
  const filePath = path.join(__dirname, `../../Factures/${date}-${commande.numero}.png`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const buffer = cvs.toBuffer('image/png');
  fs.writeFileSync(filePath, buffer);
  return filePath;
};

// Similar for generateRecuPNG
export const generateRecuPNG = async (vente: any) => {
  // Similar implementation
  const date = new Date().toISOString().split('T')[0];
  const filePath = path.join(__dirname, `../../Reçus/${date}-${vente.numero}.png`);
  // ... generate image
  return filePath;
};