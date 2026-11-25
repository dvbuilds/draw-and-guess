import { Router } from 'express';
import { wordCategoriesController, wordLanguagesController } from '../controllers/word.controller.js';

const router = Router();

router.get('/languages', wordLanguagesController);
router.get('/categories', wordCategoriesController);

export default router;
