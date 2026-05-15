export type Language = "en" | "es";

export const translations = {
  en: {
    title: "Pocket Manager Online",
    subtitle: "Build your football legacy across club and country.",
    createSolo: "Create Solo Game",
    createMultiplayer: "Create Multiplayer",
    joinMultiplayer: "Join Multiplayer",
    languageSelect: "Language Select",
    settings: "Settings",
    profile: "Profile / Save Management",
    difficulty: "Difficulty",
    soloSandbox: "Solo Sandbox Tools",
    startCareer: "Start Career",
    multiplayerLobby: "Multiplayer Lobby",
    inviteCode: "Invite Code",
    readyUp: "Ready Up",
    guestMode: "Continue as Guest",
    login: "Sign In",
    register: "Create Account",
    username: "Username",
    password: "Password",
    english: "English",
    spanish: "Spanish",
    soloIntro:
      "Select any club instantly and customize your simulation rules for a sandbox or realistic save.",
    multiplayerIntro:
      "Host async leagues for 2–20 managers with realtime standings, messages, and synchronized matchdays.",
    menuCommentary: "Commentary",
    notificationSaved: "Save synchronized.",
    notificationReady: "All managers are ready. Advancing to next matchday.",
  },
  es: {
    title: "Pocket Manager Online",
    subtitle: "Construye tu legado futbolístico con club y selección.",
    createSolo: "Crear Partida en Solitario",
    createMultiplayer: "Crear Multijugador",
    joinMultiplayer: "Unirse a Multijugador",
    languageSelect: "Seleccionar Idioma",
    settings: "Ajustes",
    profile: "Perfil / Gestión de Guardados",
    difficulty: "Dificultad",
    soloSandbox: "Herramientas Sandbox",
    startCareer: "Iniciar Carrera",
    multiplayerLobby: "Sala Multijugador",
    inviteCode: "Código de Invitación",
    readyUp: "Listo",
    guestMode: "Continuar como Invitado",
    login: "Iniciar Sesión",
    register: "Crear Cuenta",
    username: "Usuario",
    password: "Contraseña",
    english: "Inglés",
    spanish: "Español",
    soloIntro:
      "Selecciona cualquier club al instante y personaliza reglas para una partida sandbox o realista.",
    multiplayerIntro:
      "Organiza ligas asíncronas de 2–20 managers con tabla en tiempo real, chat y jornadas sincronizadas.",
    menuCommentary: "Comentario",
    notificationSaved: "Partida sincronizada.",
    notificationReady: "Todos están listos. Se avanza a la siguiente jornada.",
  },
} as const;

export type TranslationKey = keyof (typeof translations)["en"];

export const t = (language: Language, key: TranslationKey) =>
  translations[language][key] ?? translations.en[key];
