import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';
import { ApiError, asyncHandler } from '../middlewares/errorHandler.js';
import { ensureDirectoryExists } from '../utils/fileManager.js';

export const uploadLogo = asyncHandler(async (req, res) => {
  const { base64 } = req.body;
  if (!base64) throw new ApiError(400, 'Aucune image fournie');

  // extract base64 data
  const matches = String(base64).match(/^data:(image\/(png|jpeg|jpg));base64,(.+)$/);
  let buffer;
  let ext = 'png';
  if (matches) {
    ext = matches[2] === 'jpeg' ? 'jpg' : matches[2];
    buffer = Buffer.from(matches[3], 'base64');
  } else {
    // try raw base64
    try {
      buffer = Buffer.from(base64, 'base64');
    } catch (err) {
      throw new ApiError(400, 'Format d"image invalide');
    }
  }

  // ensure upload path exists
  await ensureDirectoryExists(config.UPLOAD_PATH);
  const filePath = path.join(config.UPLOAD_PATH, `logo.${ext}`);
  await fs.writeFile(filePath, buffer);

  res.json({ success: true, data: { path: `/${filePath}` }, message: 'Logo uploadé' });
});

export const saveCompanyInfo = asyncHandler(async (req, res) => {
  const { nom, email, telephone, adresse, immatriculation } = req.body;
  const info = { nom: nom || '', email: email || '', telephone: telephone || '', adresse: adresse || '', immatriculation: immatriculation || '' };
  // write to uploads/company.json
  const filePath = path.join(config.UPLOAD_PATH, 'company.json');
  await fs.writeFile(filePath, JSON.stringify(info, null, 2));
  res.json({ success: true, data: { info }, message: 'Informations de l\'entreprise sauvegardées' });
});

export const getCompanyInfo = asyncHandler(async (req, res) => {
  const filePath = path.join(config.UPLOAD_PATH, 'company.json');
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const info = JSON.parse(raw);
    res.json({ success: true, data: { info } });
  } catch (err) {
    res.json({ success: true, data: { info: null } });
  }
});

export default {
  uploadLogo,
  saveCompanyInfo,
  getCompanyInfo,
};
