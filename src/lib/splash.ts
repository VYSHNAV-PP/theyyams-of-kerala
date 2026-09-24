const SPLASH_KEY = "ke_splash_seen";

export const SPLASH_GUARD_SCRIPT = `try{if(sessionStorage.getItem("${SPLASH_KEY}"))document.documentElement.setAttribute("data-seen","1")}catch(e){}`;