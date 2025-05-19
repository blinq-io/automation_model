import { Types } from "./stable_browser";

export const LocatorStatus = {
  NOT_FOUND: "NOT_FOUND",
  FOUND_NOT_ENABLED: "FOUND_NOT_ENABLED",
  FOUND_NOT_VISIBLE: "FOUND_NOT_VISIBLE",
  FOUND_NOT_UNIQUE: "FOUND_NOT_UNIQUE",
  FOUND: "FOUND",
  ERROR: "ERROR",
};
interface Event {
  start: number;
  end: number;
  locatorStatus: string;
}
export class LocatorLog {
  selectors: any;
  timeout: number = -1;
  startTime: number = -1;
  //   locators: string[] = [];
  events: { [key: string]: Event[] } = {};
  mission: string = "";
  constructor() {
    //    this.selectors = selectors;
    // if (selectors.locators) {
    //   for (let locator of selectors.locators) {
    //     this.locators.push(JSON.stringify(locator));
    //   }
    // }
    this.startTime = Date.now();
  }
  setLocatorSearchStatus(locatorString: string, status: string) {
    if (!this.events[locatorString]) {
      this.events[locatorString] = [];
    }
    const locatorEvents = this.events[locatorString];
    if (locatorEvents.length === 0) {
      locatorEvents.push({
        start: Date.now(),
        end: Date.now(),
        locatorStatus: status,
      });
    } else {
      const lastEvent = locatorEvents[locatorEvents.length - 1];
      if (lastEvent.locatorStatus !== status) {
        lastEvent.end = Date.now();
        locatorEvents.push({
          start: Date.now(),
          end: Date.now(),
          locatorStatus: status,
        });
      } else {
        lastEvent.end = Date.now();
      }
    }
  }
  toString() {
    if(process.env.SUPRESS_ERRORS==="true"){
      return "";
    }
    let result = this.mission + "\n";
    // go over all the keys in the events object
    let locatorIndex = 0;
    for (let locatorString in this.events) {
      const locatorEvents = this.events[locatorString];
      result += `#${locatorIndex + 1} ${locatorString}\n`;
      locatorIndex++;
      for (let event of locatorEvents) {
        const startSecondAfterStart = (event.start - this.startTime) / 1000;
        const duration = (event.end - event.start) / 1000;
        result += `  ${Math.trunc(startSecondAfterStart)}s ${Math.trunc(duration)}s ${event.locatorStatus}\n`;
      }
    }
    return result;
  }
  //   findLocatorIndex(locatorString: string) {
  //     return this.locators.indexOf(locatorString);
  //   }
}
