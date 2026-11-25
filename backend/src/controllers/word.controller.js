import { listAvailableCategories, listAvailableLanguages } from '../services/wordCatalog.service.js';

export async function wordLanguagesController(_req, res) {
  const languages = await listAvailableLanguages();
  res.json({ success: true, data: languages });
}

export async function wordCategoriesController(req, res) {
  const categories = await listAvailableCategories(req.query.language ?? 'en');
  res.json({ success: true, data: categories });
}
