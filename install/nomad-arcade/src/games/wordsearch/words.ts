/** Themed word lists for the word search. Accents are dropped on the grid; Ñ is kept. */
export const THEMES = {
  es: {
    animales: ['PERRO', 'GATO', 'CABALLO', 'VACA', 'OVEJA', 'CONEJO', 'TIGRE', 'LEON', 'JIRAFA', 'ELEFANTE', 'DELFIN', 'AGUILA', 'LOBO', 'ZORRO', 'OSO', 'PATO', 'RATON', 'TORTUGA'],
    frutas: ['MANZANA', 'PERA', 'PLATANO', 'NARANJA', 'LIMON', 'FRESA', 'UVA', 'MELON', 'SANDIA', 'CEREZA', 'MANGO', 'PIÑA', 'KIWI', 'CIRUELA', 'MELOCOTON', 'HIGO', 'COCO', 'MORA'],
    paises: ['ESPAÑA', 'FRANCIA', 'ITALIA', 'PORTUGAL', 'MEXICO', 'ARGENTINA', 'CHILE', 'PERU', 'CUBA', 'CANADA', 'JAPON', 'CHINA', 'INDIA', 'EGIPTO', 'MARRUECOS', 'BRASIL', 'GRECIA', 'NORUEGA'],
    supervivencia: ['AGUA', 'FUEGO', 'REFUGIO', 'BRUJULA', 'MAPA', 'CUERDA', 'NAVAJA', 'LINTERNA', 'MANTA', 'BOTIQUIN', 'RADIO', 'MECHERO', 'SILBATO', 'FILTRO', 'TIENDA', 'COMIDA', 'VENDA', 'PILAS'],
    cuerpo: ['CABEZA', 'BRAZO', 'PIERNA', 'MANO', 'PIE', 'OJO', 'NARIZ', 'BOCA', 'OREJA', 'CORAZON', 'PULMON', 'HUESO', 'RODILLA', 'CODO', 'ESPALDA', 'CUELLO', 'DEDO', 'HOMBRO'],
  },
  en: {
    animals: ['DOG', 'CAT', 'HORSE', 'COW', 'SHEEP', 'RABBIT', 'TIGER', 'LION', 'GIRAFFE', 'ELEPHANT', 'DOLPHIN', 'EAGLE', 'WOLF', 'FOX', 'BEAR', 'DUCK', 'MOUSE', 'TURTLE'],
    fruits: ['APPLE', 'PEAR', 'BANANA', 'ORANGE', 'LEMON', 'STRAWBERRY', 'GRAPE', 'MELON', 'CHERRY', 'MANGO', 'PINEAPPLE', 'KIWI', 'PLUM', 'PEACH', 'FIG', 'COCONUT', 'LIME', 'APRICOT'],
    countries: ['SPAIN', 'FRANCE', 'ITALY', 'PORTUGAL', 'MEXICO', 'ARGENTINA', 'CHILE', 'PERU', 'CUBA', 'CANADA', 'JAPAN', 'CHINA', 'INDIA', 'EGYPT', 'MOROCCO', 'BRAZIL', 'GREECE', 'NORWAY'],
    survival: ['WATER', 'FIRE', 'SHELTER', 'COMPASS', 'MAP', 'ROPE', 'KNIFE', 'TORCH', 'BLANKET', 'MEDKIT', 'RADIO', 'LIGHTER', 'WHISTLE', 'FILTER', 'TENT', 'FOOD', 'BANDAGE', 'BATTERY'],
    body: ['HEAD', 'ARM', 'LEG', 'HAND', 'FOOT', 'EYE', 'NOSE', 'MOUTH', 'EAR', 'HEART', 'LUNG', 'BONE', 'KNEE', 'ELBOW', 'BACK', 'NECK', 'FINGER', 'SHOULDER'],
  },
} as const

export const ALPHABET = {
  es: 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ',
  en: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
} as const

export const THEME_LABELS: Record<string, string> = {
  animales: 'Animales',
  frutas: 'Frutas',
  paises: 'Países',
  supervivencia: 'Supervivencia',
  cuerpo: 'Cuerpo humano',
  animals: 'Animals',
  fruits: 'Fruits',
  countries: 'Countries',
  survival: 'Survival',
  body: 'Human body',
}
