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
function _copyContext(from: any, to: any) {
  to.browser = from.browser;
  to.page = from.page;
  to.context = from.context;
}
async function scrollPageToLoadLazyElements(page: any) {
  let lastHeight = await page.evaluate(() => document.body.scrollHeight);
  let retry = 0;
  while (true) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await new Promise((resolve) => setTimeout(resolve, 1000));
    let newHeight = await page.evaluate(() => document.body.scrollHeight);
    if (newHeight === lastHeight) {
      break;
    }
    lastHeight = newHeight;
    retry++;
    if (retry > 10) {
      break;
    }
  }

  await page.evaluate(() => window.scrollTo(0, 0));
}
type Params = Record<string, string>;
function _fixUsingParams(text: string, _params: Params) {
  if (!_params || typeof text !== "string") {
    return text;
  }
  for (let key in _params) {
    let regValue = key;
    if (key.startsWith("_")) {
      // remove the _ prefix
      regValue = key.substring(1);
    }
    text = text.replaceAll(new RegExp("{" + regValue + "}", "g"), _params[key]);
  }
  return text;
}
function getWebLogFile(logFolder: string) {
  if (!fs.existsSync(logFolder)) {
    fs.mkdirSync(logFolder, { recursive: true });
  }
  let nextIndex = 1;
  while (fs.existsSync(path.join(logFolder, nextIndex.toString() + ".json"))) {
    nextIndex++;
  }
  const fileName = nextIndex + ".json";
  return path.join(logFolder, fileName);
}

function _fixLocatorUsingParams(locator: any, _params: Params) {
  // check if not null
  if (!locator) {
    return locator;
  }
  // clone the locator
  locator = JSON.parse(JSON.stringify(locator));
  scanAndManipulate(locator, _params);
  return locator;
}
function _isObject(value: any) {
  return value && typeof value === "object" && value.constructor === Object;
}
function scanAndManipulate(currentObj: any, _params: Params) {
  for (const key in currentObj) {
    if (typeof currentObj[key] === "string") {
      // Perform string manipulation
      currentObj[key] = _fixUsingParams(currentObj[key], _params);
    } else if (_isObject(currentObj[key])) {
      // Recursively scan nested objects
      scanAndManipulate(currentObj[key], _params);
    }
  }
}
const KEYBOARD_EVENTS = [
  "ALT",
  "AltGraph",
  "CapsLock",
  "Control",
  "Fn",
  "FnLock",
  "Hyper",
  "Meta",
  "NumLock",
  "ScrollLock",
  "Shift",
  "Super",
  "Symbol",
  "SymbolLock",
  "Enter",
  "Tab",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "End",
  "Home",
  "PageDown",
  "PageUp",
  "Backspace",
  "Clear",
  "Copy",
  "CrSel",
  "Cut",
  "Delete",
  "EraseEof",
  "ExSel",
  "Insert",
  "Paste",
  "Redo",
  "Undo",
  "Accept",
  "Again",
  "Attn",
  "Cancel",
  "ContextMenu",
  "Escape",
  "Execute",
  "Find",
  "Finish",
  "Help",
  "Pause",
  "Play",
  "Props",
  "Select",
  "ZoomIn",
  "ZoomOut",
  "BrightnessDown",
  "BrightnessUp",
  "Eject",
  "LogOff",
  "Power",
  "PowerOff",
  "PrintScreen",
  "Hibernate",
  "Standby",
  "WakeUp",
  "AllCandidates",
  "Alphanumeric",
  "CodeInput",
  "Compose",
  "Convert",
  "Dead",
  "FinalMode",
  "GroupFirst",
  "GroupLast",
  "GroupNext",
  "GroupPrevious",
  "ModeChange",
  "NextCandidate",
  "NonConvert",
  "PreviousCandidate",
  "Process",
  "SingleCandidate",
  "HangulMode",
  "HanjaMode",
  "JunjaMode",
  "Eisu",
  "Hankaku",
  "Hiragana",
  "HiraganaKatakana",
  "KanaMode",
  "KanjiMode",
  "Katakana",
  "Romaji",
  "Zenkaku",
  "ZenkakuHanaku",
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "F10",
  "F11",
  "F12",
  "Soft1",
  "Soft2",
  "Soft3",
  "Soft4",
  "ChannelDown",
  "ChannelUp",
  "Close",
  "MailForward",
  "MailReply",
  "MailSend",
  "MediaFastForward",
  "MediaPause",
  "MediaPlay",
  "MediaPlayPause",
  "MediaRecord",
  "MediaRewind",
  "MediaStop",
  "MediaTrackNext",
  "MediaTrackPrevious",
  "AudioBalanceLeft",
  "AudioBalanceRight",
  "AudioBassBoostDown",
  "AudioBassBoostToggle",
  "AudioBassBoostUp",
  "AudioFaderFront",
  "AudioFaderRear",
  "AudioSurroundModeNext",
  "AudioTrebleDown",
  "AudioTrebleUp",
  "AudioVolumeDown",
  "AudioVolumeMute",
  "AudioVolumeUp",
  "MicrophoneToggle",
  "MicrophoneVolumeDown",
  "MicrophoneVolumeMute",
  "MicrophoneVolumeUp",
  "TV",
  "TV3DMode",
  "TVAntennaCable",
  "TVAudioDescription",
];
function unEscapeString(str: string) {
  const placeholder = "__NEWLINE__";
  str = str.replace(new RegExp(placeholder, "g"), "\n");
  return str;
}
function _getServerUrl() {
  let serviceUrl = "https://api.blinq.io";
  if (process.env.NODE_ENV_BLINQ === "dev") {
    serviceUrl = "https://dev.api.blinq.io";
  } else if (process.env.NODE_ENV_BLINQ === "stage") {
    serviceUrl = "https://stage.api.blinq.io";
  }
  return serviceUrl;
}

export {
  encrypt,
  decrypt,
  replaceWithLocalTestData,
  maskValue,
  _copyContext,
  scrollPageToLoadLazyElements,
  _fixUsingParams,
  getWebLogFile,
  _fixLocatorUsingParams,
  _isObject,
  scanAndManipulate,
  KEYBOARD_EVENTS,
  unEscapeString,
  Params,
  _getServerUrl,
};
