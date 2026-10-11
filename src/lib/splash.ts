export const SPLASH_KEY = "ke_splash_seen";
export const WELCOME_KEY = "ke_welcome_seen";

/**
 * Runs before first paint. If the splash already played in this browser session it is hidden
 * immediately, so reloads and in-site navigation never flash it again.
 */
export const SPLASH_GUARD_SCRIPT = `try{if(sessionStorage.getItem("${SPLASH_KEY}"))document.documentElement.setAttribute("data-ke-splash-seen","1")}catch(e){}`;
