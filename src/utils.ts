import CryptoJS from "crypto-js";
import objectPath from "object-path";

import path from "path";
import { TOTP } from "totp-generator";
import fs from "fs";
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
function _getDataFile(world: any = null, context: any = null, stable: any = null) {
  let dataFile = null;
  if (world && world.reportFolder) {
    dataFile = path.join(world.reportFolder, "data.json");
  } else if (stable && stable.reportFolder) {
    dataFile = path.join(stable.reportFolder, "data.json");
  } else if (context && context.reportFolder) {
    dataFile = path.join(context.reportFolder, "data.json");
  } else {
    dataFile = "data.json";
  }
  return dataFile;
}
function _getTestData(world = null, context = null, stable = null) {
  const dataFile = _getDataFile(world, context, stable);
  let data = {};
  if (fs.existsSync(dataFile)) {
    data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  }
  return data;
}
async function replaceWithLocalTestData(
  value: string,
  world: any,
  _decrypt = true,
  totpWait = true,
  context: any = null,
  stable: any = null
) {
  if (!value) {
    return value;
  }

  // find all the accurance of {{(.*?)}} and replace with the value
  let regex = /{{(.*?)}}/g;
  let matches = value.match(regex);
  if (matches) {
    const testData = _getTestData(world, context, stable);

    for (let i = 0; i < matches.length; i++) {
      let match = matches[i];
      let key = match.substring(2, match.length - 2);

      let newValue = objectPath.get(testData, key, null);

      if (newValue !== null) {
        value = value.replace(match, newValue);
      }
    }
  }
  if ((value.startsWith("secret:") || value.startsWith("totp:") || value.startsWith("mask:")) && _decrypt) {
    return await decrypt(value, null, totpWait);
  }
  return value;
}

function maskValue(value: string) {
  if (!value) {
    return value;
  }
  if (value.startsWith("secret:")) {
    return "secret:****";
  }
  if (value.startsWith("totp:")) {
    return "totp:****";
  }
  if (value.startsWith("mask:")) {
    return "mask:****";
  }
  return value;
}

// console.log(encrypt("Hello, World!", null));
// console.log(decrypt("U2FsdGVkX1+6mavadgkMgJPIhR3IO1pDkx36TjTyoyE=", null));
export { encrypt, decrypt, replaceWithLocalTestData, maskValue };
