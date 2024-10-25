import CryptoJS from "crypto-js";

import path from "path";
import { TOTP } from "totp-generator";
// Function to encrypt a string
function encrypt(text: string, key: string | null = null) {
  if (!key) {
    key = _findKey();
  }
  return CryptoJS.AES.encrypt(text, key).toString();
}

// Function to decrypt a string
async function decrypt(encryptedText: string, key: string | null = null, totpWait: boolean = true) {
  if (!key) {
    key = _findKey();
  }
  if (encryptedText.startsWith("secret:")) {
    encryptedText = encryptedText.substring(7);
  }
  if (encryptedText.startsWith("totp:")) {
    encryptedText = encryptedText.substring(5);
    const bytes = CryptoJS.AES.decrypt(encryptedText, key);
    encryptedText = bytes.toString(CryptoJS.enc.Utf8);
    let { otp, expires } = TOTP.generate(encryptedText);
    if (totpWait) {
      // expires is in unix time, check if we have at least 10 seconds left, if it's less than wait for the expires time
      if (expires - Date.now() < 10000) {
        await new Promise((resolve) => setTimeout(resolve, (expires - Date.now() + 1000) % 30000));
        ({ otp, expires } = TOTP.generate(encryptedText));
      }
    }
    return otp;
  }
  if (encryptedText.startsWith("mask:")) {
    return encryptedText.substring(5);
  }
  const bytes = CryptoJS.AES.decrypt(encryptedText, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}
function _findKey() {
  if (process.env.PROJECT_ID) {
    return process.env.PROJECT_ID;
  }
  if (process.env.PROJECT_PATH) {
    return path.basename(process.env.PROJECT_PATH);
  }
  // find the project folder name
  let folder = process.cwd();
  // extract the base folder name
  return path.basename(folder);
}
// console.log(encrypt("Hello, World!", null));
// console.log(decrypt("U2FsdGVkX1+6mavadgkMgJPIhR3IO1pDkx36TjTyoyE=", null));
export { encrypt, decrypt };
