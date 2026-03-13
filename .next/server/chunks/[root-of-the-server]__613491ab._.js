module.exports=[54799,(e,t,r)=>{t.exports=e.x("crypto",()=>require("crypto"))},14747,(e,t,r)=>{t.exports=e.x("path",()=>require("path"))},22734,(e,t,r)=>{t.exports=e.x("fs",()=>require("fs"))},54970,e=>{"use strict";var t=e.i(22734),r=e.i(14747),i=e.i(54799);let o=`-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAo64q4Lqis/wecZOyxdtp
GZ/zjexdyYhPs6UqhwvXbHpU6DCNRweqSr2zKiYIEHqzgKB6ESNOMmrBgBW3mtll
MBV3HQx6OA+C5JnZI7P9Hq7WxD0DPtHPdOwyJhp5uFsvGPfPOhSmutTX9d136w4P
bHsuAf2B0OQtsNXC/F4IpEABko6YQuNMe1Cr0RZccNHcjkPqKsRHjygNhr0QcTBH
NAxg8rIbWQvNTMqIgkzkTLBR8HoNrTPhDThME05gndED0lPzYFA8pP6W8yOHdVZG
3Ri3vnzOxcH9/IvbWbsB4+bb6R9k6hb34NmGP6CW56/jsQra3FzittlZ8rhetoSA
9QIDAQAB
-----END PUBLIC KEY-----`;function a(){let e,i=process.env.LICENSE_KEY_PATH||"./LICENSE.key",o=r.default.resolve(process.cwd(),i);if(!t.default.existsSync(o))throw Error(`LICENSE.key not found at: ${o}
Place your LICENSE.key file in the app root directory.
Set LICENSE_KEY_PATH in .env if it is in a different location.`);try{e=t.default.readFileSync(o,"utf8")}catch{throw Error(`Cannot read LICENSE.key at: ${o}`)}try{return JSON.parse(e)}catch{throw Error(`LICENSE.key is not valid JSON. The file may be corrupted.
Contact support@ctitans.com for a replacement.`)}}function n(e){let t,{signature:r,...a}=e;if(!r)throw Error(`LICENSE.key is missing a signature.
Contact support@ctitans.com for a valid license.`);try{let e=i.default.createVerify("RSA-SHA256");e.update(JSON.stringify(a)),t=e.verify(o,r,"base64")}catch{throw Error(`License signature verification failed (crypto error).
Contact support@ctitans.com`)}if(!t)throw Error(`License signature is invalid. The file may have been tampered with.
Contact support@ctitans.com for a valid license.`)}function s(e){let t=(process.env.APP_DOMAIN||"").toLowerCase().trim(),r=(e.domain||"").toLowerCase().trim();if(t!==r){if("edudesk.local"===r){let t=new Date(new Date(e.issuedAt));if(t.setDate(t.getDate()+30),new Date<=t)return;throw Error(`The 30-day setup window for edudesk.local has expired.
Update APP_DOMAIN in .env to match your licensed domain: ${e.domain}`)}throw Error(`Domain mismatch.
License issued for : ${e.domain}
Current APP_DOMAIN : ${t}
Update APP_DOMAIN in .env or contact support@ctitans.com`)}}function c(){let e=a();return n(e),s(e),e}e.s(["readLicense",()=>a,"validateDomain",()=>s,"validateLicense",()=>c,"validateSignature",()=>n])}];

//# sourceMappingURL=%5Broot-of-the-server%5D__613491ab._.js.map