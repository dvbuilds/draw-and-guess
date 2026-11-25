const ENGLISH_WORDS = [
  ['Alligator', 'Animals'], ['Butterfly', 'Animals'], ['Dolphin', 'Animals'],
  ['Elephant', 'Animals'], ['Giraffe', 'Animals'], ['Penguin', 'Animals'],
  ['Rabbit', 'Animals'], ['Turtle', 'Animals'],
  ['Avocado', 'Food'], ['Banana', 'Food'], ['Hamburger', 'Food'],
  ['Pancake', 'Food'], ['Popcorn', 'Food'], ['Sandwich', 'Food'],
  ['Spaghetti', 'Food'], ['Watermelon', 'Food'],
  ['Backpack', 'Objects'], ['Camera', 'Objects'], ['Guitar', 'Objects'],
  ['Ladder', 'Objects'], ['Microscope', 'Objects'], ['Sunglasses', 'Objects'],
  ['Toothbrush', 'Objects'], ['Umbrella', 'Objects'],
  ['Cactus', 'Nature'], ['Desert', 'Nature'], ['Earthquake', 'Nature'],
  ['Forest', 'Nature'], ['Rainbow', 'Nature'], ['Snowflake', 'Nature'],
  ['Thunderstorm', 'Nature'], ['Volcano', 'Nature'],
  ['Aquarium', 'Places'], ['Castle', 'Places'], ['Farm', 'Places'],
  ['Hospital', 'Places'], ['Library', 'Places'], ['Museum', 'Places'],
  ['School', 'Places'], ['Stadium', 'Places'],
  ['Camping', 'Activities'], ['Dancing', 'Activities'], ['Fishing', 'Activities'],
  ['Gardening', 'Activities'], ['Juggling', 'Activities'], ['Skiing', 'Activities'],
  ['Skateboarding', 'Activities'], ['Swimming', 'Activities'],
  ['Firefly', 'Combination'], ['Fire truck', 'Combination'],
  ['Ice cream', 'Combination'], ['Jellyfish', 'Combination'],
  ['Lighthouse', 'Combination'], ['Moonlight', 'Combination'],
  ['Snowman', 'Combination'], ['Toothpaste', 'Combination'],
].map(([text, category]) => ({ text, category }));

const SPANISH_WORDS = [
  ['Gato', 'Animals'], ['Perro', 'Animals'], ['Caballo', 'Animals'], ['Mariposa', 'Animals'],
  ['Manzana', 'Food'], ['Pan', 'Food'], ['Queso', 'Food'], ['Arroz', 'Food'],
  ['Libro', 'Objects'], ['Silla', 'Objects'], ['Teléfono', 'Objects'], ['Llave', 'Objects'],
  ['Río', 'Nature'], ['Montaña', 'Nature'], ['Nube', 'Nature'], ['Árbol', 'Nature'],
  ['Casa', 'Places'], ['Playa', 'Places'], ['Parque', 'Places'], ['Mercado', 'Places'],
  ['Bailar', 'Activities'], ['Correr', 'Activities'], ['Leer', 'Activities'], ['Cocinar', 'Activities'],
  ['Camión de bomberos', 'Combination'], ['Helado', 'Combination'],
  ['Estrella de mar', 'Combination'], ['Arcoíris', 'Combination'],
].map(([text, category]) => ({ text, category, language: 'es' }));

const FRENCH_WORDS = [
  ['Chat', 'Animals'], ['Chien', 'Animals'], ['Cheval', 'Animals'], ['Papillon', 'Animals'],
  ['Pomme', 'Food'], ['Pain', 'Food'], ['Fromage', 'Food'], ['Riz', 'Food'],
  ['Livre', 'Objects'], ['Chaise', 'Objects'], ['Téléphone', 'Objects'], ['Clé', 'Objects'],
  ['Rivière', 'Nature'], ['Montagne', 'Nature'], ['Nuage', 'Nature'], ['Arbre', 'Nature'],
  ['Maison', 'Places'], ['Plage', 'Places'], ['Parc', 'Places'], ['Marché', 'Places'],
  ['Danser', 'Activities'], ['Courir', 'Activities'], ['Lire', 'Activities'], ['Cuisiner', 'Activities'],
  ['Camion de pompiers', 'Combination'], ['Glace', 'Combination'],
  ['Étoile de mer', 'Combination'], ['Arc-en-ciel', 'Combination'],
].map(([text, category]) => ({ text, category, language: 'fr' }));

export const SEED_WORDS = [
  ...ENGLISH_WORDS.map((word) => ({ ...word, language: 'en' })),
  ...SPANISH_WORDS,
  ...FRENCH_WORDS,
];
