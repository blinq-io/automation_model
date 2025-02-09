import CryptoJS from "crypto-js";
import objectPath from "object-path";

import path from "path";
import { TOTP } from "totp-generator";
import fs from "fs";
import axios from "axios";
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
function _convertToRegexQuery(text: string, isRegex: boolean, fullMatch: boolean, ignoreCase: boolean) {
  let query = "internal:text=/";
  let queryEnd = "/";
  let pattern = "";
  const regexEndPattern = /\/([gimuy]*)$/;
  if (text.startsWith("/")) {
    const match = regexEndPattern.test(text);
    if (match) {
      try {
        const regex = new RegExp(text.substring(1, text.lastIndexOf("/")), text.match(regexEndPattern)![1]);
        return "internal:text=" + text;
      } catch {
        // not regex
      }
    }
  }
  if (isRegex) {
    pattern = text;
  } else {
    // first remove \n then split the text by any white space,
    let parts = text.replace(/\\n/g, "").split(/\s+/);
    //  escape regex split part
    parts = parts.map((part) => escapeRegex(part));
    pattern = parts.join("\\s*");
  }
  if (fullMatch) {
    pattern = "^\\s*" + pattern + "\\s*$";
  }
  if (ignoreCase) {
    queryEnd += "i";
  }
  return query + pattern + queryEnd;
}
function escapeRegex(str: string) {
  // Special regex characters that need to be escaped
  const specialChars = [
    "/",
    ".",
    "*",
    "+",
    "?",
    "^",
    "$",
    "(",
    ")",
    "[",
    "]",
    "{",
    "}",
    "|",
    "\\",
    "-",
    "'",
    '"',
    ">", // added to avoid confusion with pw selectorsxw
  ];

  // Create a regex that will match all special characters
  const escapedRegex = new RegExp(specialChars.map((char) => `\\${char}`).join("|"), "g");

  // Escape special characters by prefixing them with a backslash
  return str.replace(escapedRegex, "\\$&");
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
      if (key && key.trim().startsWith("date:")) {
        const dateQuery = key.substring(5);
        const parts = dateQuery.split(">>");
        const returnTemplate = parts[1] || null;

        let serviceUrl = _getServerUrl();
        const config = {
          method: "post",
          url: `${serviceUrl}/api/runs/find-date/find`,
          headers: {
            "x-source": "true",
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.TOKEN}`,
          },
          data: JSON.stringify({
            value: parts[0],
          }),
        };

        let result = await axios.request(config);
        //console.log(JSON.stringify(frameDump[0]));
        if (result.status !== 200 || !result.data || result.data.status !== true || !result.data.result) {
          console.error("Failed to find date");
          throw new Error("Failed to find date");
        }
        value = formatDate(result.data.result, returnTemplate);
      } else {
        let newValue = objectPath.get(testData, key, null);

        if (newValue !== null) {
          value = value.replace(match, newValue);
        }
      }
    }
  }
  if ((value.startsWith("secret:") || value.startsWith("totp:") || value.startsWith("mask:")) && _decrypt) {
    return await decrypt(value, null, totpWait);
  }
  // check if the value is ${}
  if (value.startsWith("${") && value.endsWith("}")) {
    value = evaluateString(value, context.examplesRow);
  }

  return value;
}
function evaluateString(template: string, parameters: any) {
  if (!parameters) {
    parameters = {};
  }
  try {
    return new Function(...Object.keys(parameters), `return \`${template}\`;`)(...Object.values(parameters));
  } catch (e) {
    console.error(e);
    return template;
  }
}
function formatDate(dateStr: string, format: string | null): string {
  if (!format) {
    return dateStr;
  }
  // Split the input date string
  const [dd, mm, yyyy] = dateStr.split("-");

  // Define replacements
  const replacements: Record<string, string> = {
    dd: dd,
    mm: mm,
    yyyy: yyyy,
  };

  // Replace format placeholders with actual values
  return format.replace(/dd|mm|yyyy/g, (match) => replacements[match]);
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

function extractStepExampleParameters(step: any) {
  if (
    !step ||
    !step.gherkinDocument ||
    !step.pickle ||
    !step.pickle.astNodeIds ||
    !(step.pickle.astNodeIds.length > 1) ||
    !step.gherkinDocument.feature ||
    !step.gherkinDocument.feature.children
  ) {
    return {};
  }
  try {
    const scenarioId = step.pickle.astNodeIds[0];
    const exampleId = step.pickle.astNodeIds[1];
    // find the scenario in the gherkin document
    const scenario = step.gherkinDocument.feature.children.find(
      (child: any) => child.scenario.id === scenarioId
    ).scenario;
    if (!scenario || !scenario.examples || !scenario.examples[0].tableBody) {
      return {};
    }
    // find the table body in the examples
    const row = scenario.examples[0].tableBody.find((r: any) => r.id === exampleId);
    if (!row) {
      return {};
    }
    // extract the cells values (row.cells.value) into an array
    const values = row.cells.map((cell: any) => cell.value);
    // extract the table headers keys (scenario.examples.tableHeader.cells.value) into an array
    const keys = scenario.examples[0].tableHeader.cells.map((cell: any) => cell.value);
    // create a dictionary of the keys and values
    const params: any = {};
    for (let i = 0; i < keys.length; i++) {
      params[keys[i]] = values[i];
    }
    return params;
  } catch (e) {
    console.error(e);
    return {};
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
  _convertToRegexQuery,
  extractStepExampleParameters,
};
