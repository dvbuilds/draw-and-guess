export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
];

export const TRANSLATIONS = {
  en: {
    appTagline: 'Real-time Multiplayer Sketch Party',
    navHome: 'Home',
    navCreate: 'Create Room',
    navJoin: 'Join Room',
    navLobby: 'Lobby',
    navGame: 'Game',
    navResults: 'Results',
    createRoomTitle: 'Create a Room',
    joinRoomTitle: 'Join a Room',
    languageLabel: 'Language',
    moderationTitle: 'Host Moderation',
    voteKickTitle: 'VoteKick',
    announcementsTitle: 'Host Announcement',
  },
  es: {
    appTagline: 'Juego Multijugador de Dibujo en Vivo',
    navHome: 'Inicio',
    navCreate: 'Crear Sala',
    navJoin: 'Unirse',
    navLobby: 'Sala',
    navGame: 'Juego',
    navResults: 'Resultados',
    createRoomTitle: 'Crear una Sala',
    joinRoomTitle: 'Unirse a una Sala',
    languageLabel: 'Idioma',
    moderationTitle: 'Moderación del Anfitrión',
    voteKickTitle: 'Votar Expulsión',
    announcementsTitle: 'Anuncio del Anfitrión',
  },
  fr: {
    appTagline: 'Jeu de Dessin Multijoueur en Direct',
    navHome: 'Accueil',
    navCreate: 'Créer un Salon',
    navJoin: 'Rejoindre',
    navLobby: 'Salon',
    navGame: 'Partie',
    navResults: 'Résultats',
    createRoomTitle: 'Créer un Salon',
    joinRoomTitle: 'Rejoindre un Salon',
    languageLabel: 'Langue',
    moderationTitle: "Modération de l'Hôte",
    voteKickTitle: "Vote d'Exclusion",
    announcementsTitle: "Annonce de l'Hôte",
  },
};

export function getTranslations(code) {
  return TRANSLATIONS[code] || TRANSLATIONS.en;
}
