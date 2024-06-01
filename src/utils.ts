import CryptoJS from "crypto-js";

import path from "path";
// Function to encrypt a string
function encrypt(text: string, key: string | null = null) {
  if (!key) {
    key = _findKey();
  }
  return CryptoJS.AES.encrypt(text, key).toString();
}

// Function to decrypt a string
function decrypt(encryptedText: string, key: string | null = null) {
  if (!key) {
    key = _findKey();
  }
  const bytes = CryptoJS.AES.decrypt(encryptedText, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}
function _findKey() {
  if (process.env.PROJECT_ID) {
    return process.env.PROJECT_ID;
  }
  // find the project folder name
  let folder = process.cwd();
  // extract the base folder name
  return path.basename(folder);
}
// console.log(encrypt("Hello, World!", null));
// console.log(decrypt("U2FsdGVkX1+6mavadgkMgJPIhR3IO1pDkx36TjTyoyE=", null));
export { encrypt, decrypt };
