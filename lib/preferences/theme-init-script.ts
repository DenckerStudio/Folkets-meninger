import { PREFERENCE_KEYS } from './keys';

/** Inline script to apply theme/motion before paint and avoid flash. */
export const THEME_INIT_SCRIPT = `(function(){try{var raw=localStorage.getItem(${JSON.stringify(PREFERENCE_KEYS.app.preferences)});var prefs=raw?JSON.parse(raw):{};var theme=prefs.theme||'system';var motion=prefs.motion||'system';var resolved=theme==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):theme;var root=document.documentElement;root.classList.toggle('dark',resolved==='dark');var reduce=motion==='reduce'||(motion==='system'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);root.classList.toggle('motion-reduce',reduce);}catch(e){}})();`;
