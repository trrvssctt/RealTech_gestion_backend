import express from 'express';
import settingsController from '../controllers/settingsController.js';

const router = express.Router();

// upload logo as base64 in JSON: { base64: 'data:image/png;base64,...' }
router.post('/logo', settingsController.uploadLogo);
router.post('/company', settingsController.saveCompanyInfo);
router.get('/company', settingsController.getCompanyInfo);

export default router;
