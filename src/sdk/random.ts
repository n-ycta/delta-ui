/** Secure UUIDs also in WebViews / HTTP contexts without randomUUID. Never use Math.random for channels. */
export function randomId(): string {
 if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
 const b = new Uint8Array(16);globalThis.crypto.getRandomValues(b);
 b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
 const h=Array.from(b,n=>n.toString(16).padStart(2,'0')).join('');
 return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
