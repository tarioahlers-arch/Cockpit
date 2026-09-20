// Heuristische Muster fuer die automatisierten ShopFil-Checks.
// Bewusst heuristisch (wie ein schneller erster Blick eines Testers) - kein Ersatz
// fuer die manuellen, qualitativen Kriterien (Checkout-Erlebnis, Service-Antwortzeit etc.).

export const CHAT_PATTERNS: RegExp[] = [
  /intercom/i,
  /zendesk/i,
  /tawk\.to/i,
  /drift\.com/i,
  /livechatinc|livechat\.com/i,
  /freshchat|freshworks/i,
  /userlike/i,
  /crisp\.chat/i,
  /hubspot.*conversations/i,
  /class="[^"]*(chat-widget|chatbot)[^"]*"/i,
];

export const CONTACT_PATTERNS: RegExp[] = [
  /href="tel:/i,
  /href="mailto:/i,
  />\s*kontakt\s*</i,
  />\s*contact\s*(us)?\s*</i,
  /kundenservice/i,
];

export const RETURN_PATTERNS: RegExp[] = [
  /r(ü|u)ckgabe/i,
  /retoure/i,
  /widerruf/i,
  /return[-\s]?policy/i,
  /money[-\s]?back/i,
];

export const PRICE_ANCHOR_PATTERNS: RegExp[] = [
  /class="[^"]*(old-price|was-price|compare-at-price|price--compare|regular-price|strike)[^"]*"/i,
  /<del[^>]*>\s*[€$]?\s*\d/i,
  /statt\s*[€$]?\s*\d+[.,]\d{2}/i,
  /uvp[:\s]*[€$]?\s*\d/i,
];

export const SCARCITY_PATTERNS: RegExp[] = [
  /nur noch \d+/i,
  /noch \d+\s*(stück|stueck|auf lager|verfügbar|verfuegbar)/i,
  /only \d+ left/i,
  /limited stock/i,
  /fast ausverkauft/i,
];

export const SOCIAL_PROOF_PATTERNS: RegExp[] = [
  /aggregaterating/i,
  /bewertung(en)?/i,
  /trustpilot/i,
  /bazaarvoice/i,
  /yotpo/i,
  /bestseller/i,
  /\d+\s*(mal|x)\s*(verkauft|gekauft)/i,
  /reviews?\.io/i,
];

export const COUNTDOWN_PATTERNS: RegExp[] = [
  /class="[^"]*(countdown|timer)[^"]*"/i,
  /countdown\.js|countdown-timer/i,
  /endet in\s*\d/i,
  /noch\s*\d{1,2}:\d{2}:\d{2}/i,
];

export const PERSONALIZATION_PATTERNS: RegExp[] = [
  /zuletzt angesehen/i,
  /empfohlen für dich|empfohlen fuer dich/i,
  /das könnte ihnen auch gefallen|das koennte ihnen auch gefallen/i,
  /recently viewed/i,
  /recommended for you/i,
  /kunden kauften auch/i,
];

export const EXIT_INTENT_PATTERNS: RegExp[] = [
  /optinmonster/i,
  /privy\.com|privy_client/i,
  /poptin/i,
  /sumo\.com|sumome/i,
  /hello ?bar/i,
  /exit[-_]?intent/i,
];

export const TRUST_SEAL_PATTERNS: RegExp[] = [
  /trusted ?shops/i,
  /käuferschutz|kaeuferschutz/i,
  /tüv|tuev/i,
  /geprüfter shop|geprueter shop|geprüfter online-?shop/i,
  /ssl-siegel/i,
];

export const COOKIE_PATTERNS: RegExp[] = [
  /cookiebot/i,
  /usercentrics/i,
  /onetrust/i,
  /borlabs/i,
  /cookie-consent|cookie_consent|cookieconsent/i,
  /(cookies?\s+akzeptieren|accept\s+cookies)/i,
];
