import path from "path";
import fs from "fs";
import { _stepNameToTemplate } from "./route.js";
import crypto from "crypto";
import { tmpdir } from "os";

interface RequestEntry {
  requestId: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  postData: string | undefined;
  requestTimestamp: number;
  stepHash: string;
  /* added later */
  response?: {
    status: number | null;
    headers: Record<string, string>;
    url: string;
    timestamp: number;
    body: unknown;
    contentType: string | null;
    error?: string;
  };
}

function _getNetworkFile(world: any = null, web: any = null, context: any = null) {
  let networkFile = null;
  if (world && world.reportFolder) {
    networkFile = path.join(world.reportFolder, "network.json");
  } else if (web.reportFolder) {
    networkFile = path.join(web.reportFolder, "network.json");
  } else if (context && context.reportFolder) {
    networkFile = path.join(context.reportFolder, "network.json");
  } else {
    networkFile = "network.json";
  }
  return networkFile;
}
function registerDownloadEvent(page: any, world: any, context: any) {
  if (page) {
    let downloadPath = "./downloads";
    if (world && world.downloadsPath) {
      downloadPath = world.downloadsPath;
    } else if (context && context.downloadsPath) {
      downloadPath = context.downloadsPath;
    }
    if (!fs.existsSync(downloadPath)) {
      try {
        fs.mkdirSync(downloadPath);
      } catch (e) {
        // ignore
      }
    }
    page.on("download", async (download: any) => {
      const suggestedFilename = download.suggestedFilename(); // Get the original file name
      const filePath = `${downloadPath}/${suggestedFilename}`;

      // Save the download with the original name
      await download.saveAs(filePath);
      console.log(`Downloaded file saved as: ${filePath}`);
    });
  }
}

function registerNetworkEvents(world: any, web: any, context: any, page: any) {
  // Map to hold request start times and IDs
  const networkFile = _getNetworkFile(world, web, context);
  function saveNetworkData() {
    if (context && context.networkData) {
      try {
        fs.writeFileSync(networkFile, JSON.stringify(context.networkData, null, 2), "utf8");
      } catch (error) {
        console.error("Error saving network data:", error);
      }
    }
  }
  if (!context) {
    console.error("No context found to register network events");
    return;
  }

  const requestTimes = new Map();
  let requestIdCounter = 0;

  if (page) {
    if (!context.networkData) {
      context.networkData = [];
      const networkData = context.networkData;
      // Event listener for when a request is made
      page.on("request", (request: any) => {
        try {
          // console.log("Request started:", request.url());
          const requestId = requestIdCounter++;
          request.requestId = requestId; // Assign a unique ID to the request
          handleRequest(request);
          const startTime = Date.now();
          requestTimes.set(requestId, startTime);

          // Initialize data for this request
          networkData.push({
            requestId,
            requestStart: startTime,
            requestUrl: request.url(),
            method: request.method(),
            status: "Pending",
            responseTime: null,
            responseReceived: null,
            responseEnd: null,
            size: null,
          });
          saveNetworkData();
        } catch (error) {
          // console.error("Error handling request:", error);
        }
      });

      // Event listener for when a response is received
      page.on("response", async (response: any) => {
        try {
          const request = response.request();
          const requestId = request.requestId;
          const receivedTime = Date.now();
          // await handleRequestFinishedOrFailed(request, false);
          // Find the corresponding data object
          const data = networkData.find((item: any) => item.requestId === requestId);

          if (data) {
            data.status = response.status();
            data.responseReceived = receivedTime;
            saveNetworkData();
          } else {
            // console.error("No data found for request ID", requestId);
          }
        } catch (error) {
          // console.error("Error handling response:", error);
        }
      });

      // Event listener for when a request is finished
      page.on("requestfinished", async (request: any) => {
        try {
          const requestId = request.requestId;
          const endTime = Date.now();
          const startTime = requestTimes.get(requestId);
          await handleRequestFinishedOrFailed(request, false);

          const response = await request.response();
          const timing = request.timing();

          // Find the corresponding data object
          const data = networkData.find((item: any) => item.requestId === requestId);

          if (data) {
            data.responseEnd = endTime;
            data.responseTime = endTime - startTime;
            // Get response size
            try {
              let size = 0;
              if (responseHasBody(response)) {
                const buf = await response.body();
                size = buf?.length ?? 0;
              }
              data.size = size;
            } catch {
              data.size = 0;
            }
            const type = request.resourceType();
            /*
            domainLookupStart: 80.655,
            domainLookupEnd: 80.668,
            connectStart: 80.668,
            secureConnectionStart: 106.688,
            connectEnd: 129.69,
            requestStart: 129.81,
            responseStart: 187.006,
            responseEnd: 188.209
            */
            data.type = type;
            data.domainLookupStart = timing.domainLookupStart;
            data.domainLookupEnd = timing.domainLookupEnd;
            data.connectStart = timing.connectStart;
            data.secureConnectionStart = timing.secureConnectionStart;
            data.connectEnd = timing.connectEnd;
            data.requestStart = timing.requestStart;
            data.responseStart = timing.responseStart;
            data.responseEnd = timing.responseEnd;
            saveNetworkData();
            if (world && world.attach) {
              world.attach(JSON.stringify(data), { mediaType: "application/json+network" });
            }
          } else {
            // console.error("No data found for request ID", requestId);
          }
        } catch (error) {
          // console.error("Error handling request finished:", error);
        }
      });

      // Event listener for when a request fails
      page.on("requestfailed", async (request: any) => {
        try {
          const requestId = request.requestId;
          const endTime = Date.now();
          const startTime = requestTimes.get(requestId);
          await handleRequestFinishedOrFailed(request, true);
          try {
            const res = await request.response();
            const statusCode = res ? res.status() : request.failure().errorText;

            // Find the corresponding data object
            const data = networkData.find((item: any) => item.requestId === requestId);
            if (data) {
              data.responseEnd = endTime;
              data.responseTime = endTime - startTime;
              data.status = statusCode;
              data.size = 0;
              saveNetworkData();
              if (world && world.attach) {
                world.attach(JSON.stringify(data), { mediaType: "application/json+network" });
              }
            } else {
              // console.error("No data found for request ID", requestId);
            }
          } catch (error) {
            // ignore
          }
        } catch (error) {
          // console.error("Error handling request failed:", error);
        }
      });
    }
  } else {
    console.error("No page found to register network events");
  }
}

async function appendEntryToStepFile(stepHash: string, entry: RequestEntry) {
  const debug = createDebug("network:appendEntryToStepFile");
  const file = path.join(detailedNetworkFolder, `${stepHash}.json`);
  debug("appending to step file:", file);
  let data: RequestEntry[] = [];
  try {
    /* read if it already exists */
    const txt = await fs.promises.readFile(file, "utf8");
    data = JSON.parse(txt);
  } catch {
    /* ignore – file does not exist or cannot be parsed */
  }

  data.push(entry);
  try {
    debug("writing to step file:", file);
    await fs.promises.writeFile(file, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    debug("Error writing to step file:", error);
  }
}

interface ExecutionState {
  currentStepHash: string | null;
  previousStepHash: string | null;
  liveRequestsMap: Map<any, RequestEntry>;
  liveRequestsMapPrevious: Map<any, RequestEntry>;
}
const detailedNetworkFolder = path.join(tmpdir(), "blinq_network_events");
let outOfStep = true;
const executionState = {
  currentStepHash: null,
  previousStepHash: null,
  liveRequestsMap: new Map<any, any>(),
  liveRequestsMapPrevious: new Map<any, any>(),
} as ExecutionState;

export function networkBeforeStep(stepName: string) {
  outOfStep = false;
  const storeDetailedNetworkData = process.env.STORE_DETAILED_NETWORK_DATA === "true";
  if (!storeDetailedNetworkData) {
    return;
  }
  // check if the folder exists, if not create it
  if (!fs.existsSync(detailedNetworkFolder)) {
    fs.mkdirSync(detailedNetworkFolder, { recursive: true });
  }
  // const stepHash = stepNameToHash(stepName);
  let stepHash = "";

  executionState.liveRequestsMapPrevious = executionState.liveRequestsMap;
  executionState.liveRequestsMap = new Map<any, any>();
  stepHash = stepNameToHash(stepName);
  executionState.previousStepHash = executionState.currentStepHash; // ➊ NEW
  executionState.currentStepHash = stepHash;
  // check if the file exists, if exists delete it
  const networkFile = path.join(detailedNetworkFolder, `${stepHash}.json`);
  try {
    fs.rmSync(path.join(networkFile), { force: true });
  } catch (err) {
    // Ignore error if file does not exist
  }
}
async function saveMap(current: boolean) {
  try {
    if (current) {
      const entries = Array.from(executionState.liveRequestsMap.values());
      const file = path.join(detailedNetworkFolder, `${executionState.currentStepHash}.json`);
      await fs.promises.writeFile(file, JSON.stringify(entries, null, 2), "utf8");
    } else {
      const entries = Array.from(executionState.liveRequestsMapPrevious.values());
      const file = path.join(detailedNetworkFolder, `${executionState.previousStepHash}.json`);
      await fs.promises.writeFile(file, JSON.stringify(entries, null, 2), "utf8");
    }
  } catch (error) {
    console.error("Error saving map data:", error);
  }
}
export async function networkAfterStep(stepName: string) {
  const storeDetailedNetworkData = process.env.STORE_DETAILED_NETWORK_DATA === "true";
  if (!storeDetailedNetworkData) {
    return;
  }
  //await new Promise((r) => setTimeout(r, 1000));

  await saveMap(true);

  /* reset for next step */
  //executionState.previousStepHash = executionState.currentStepHash; // ➋ NEW
  //executionState.liveRequestsMap.clear();
  outOfStep = true;
}

function stepNameToHash(stepName: string): string {
  const templateName = _stepNameToTemplate(stepName);
  // create hash from the template name
  return crypto.createHash("sha256").update(templateName).digest("hex");
}
function handleRequest(request: any) {
  const storeDetailedNetworkData = process.env.STORE_DETAILED_NETWORK_DATA === "true";
  if (!storeDetailedNetworkData || !executionState.currentStepHash) {
    return;
  }
  const entry: RequestEntry = {
    requestId: request.requestId,
    url: request.url(),
    method: request.method(),
    headers: request.headers(),
    postData: request.postData(),
    requestTimestamp: Date.now(),
    stepHash: executionState.currentStepHash,
  };

  executionState.liveRequestsMap.set(request, entry);
  // console.log("Request started:", entry);
}

async function handleRequestFinishedOrFailed(request: any, failed: boolean) {
  const storeDetailedNetworkData = process.env.STORE_DETAILED_NETWORK_DATA === "true";
  if (!storeDetailedNetworkData) {
    return;
  }

  // const response = await request.response(); // This may be null if the request failed
  let entry = executionState.liveRequestsMap.get(request);
  if (!entry) {
    // check if the request is in the previous step's map
    entry = executionState.liveRequestsMapPrevious.get(request);
    if (!entry) {
      entry = {
        requestId: request.requestId,
        url: request.url(),
        method: request.method?.() ?? "GET",
        headers: request.headers?.() ?? {},
        postData: request.postData?.() ?? undefined,
        stepHash: executionState.previousStepHash ?? "unknown",
        requestTimestamp: Date.now(),
      } as RequestEntry;
    }
  }
  // Remove the request from the live requests map
  let respData: RequestEntry["response"];

  // executionState.liveRequestsMap.delete(request);

  if (failed) {
    // Handle failed request
    respData = {
      status: null,
      headers: {},
      url: request.url(),
      timestamp: Date.now(),
      body: null,
      contentType: null,
      error: "Request failed",
    };
  } else {
    const response = await request.response();
    const headers = response?.headers?.() || {};
    let contentType = headers["content-type"] || null;
    let body = null;

    try {
      if (responseHasBody(response)) {
        if (contentType && contentType.includes("application/json")) {
          body = JSON.parse(await response.text());
        } else if (
          (contentType && contentType.includes("text")) ||
          (contentType && contentType.includes("application/csv"))
        ) {
          body = await response.text();
          if (contentType.includes("application/csv")) contentType = "text/csv";
        } else {
          // If you want binary, you could read it here—but only when responseHasBody(response) is true
          // const buffer = await response.body();
          // body = buffer.toString("base64");
        }
      } else {
        // For redirects / no-body statuses, it's useful to keep redirect info
        // e.g., include Location header if present
        // body stays null
      }
    } catch (err) {
      console.error("Error reading response body:", err);
    }

    respData = {
      status: response.status(),
      headers,
      url: response.url(),
      timestamp: Date.now(),
      body,
      contentType,
    };
  }

  if (executionState.liveRequestsMap.has(request)) {
    /* “normal” path – keep it in the buffer */
    entry.response = respData;
    if (outOfStep && executionState.currentStepHash) {
      await saveMap(true);
    }
  } else {
    if (executionState.liveRequestsMapPrevious.has(request)) {
      entry.response = respData;
      await saveMap(false);
    } else {
      /* orphan response – append directly to the previous step file */
      entry.response = respData;
      await appendEntryToStepFile(entry.stepHash, entry); // ➍ NEW
    }
  }

  entry.response = respData;

  return;
}
function responseHasBody(response: any): boolean {
  if (!response) return false;
  const s = response.status?.() ?? 0;
  // RFC 7231: 1xx, 204, 205, 304 have no body. Playwright: 3xx (redirect) body is unavailable.
  if ((s >= 100 && s < 200) || s === 204 || s === 205 || s === 304 || (s >= 300 && s < 400)) return false;
  // HEAD responses have no body by definition
  const method = response.request?.().method?.() ?? "GET";
  if (method === "HEAD") return false;
  return true;
}
// Handle successful request with a response
// const headers = response.headers();
// const contentType = headers["content-type"] || "";
// let body = null;

// try {
//   if (contentType.includes("application/json")) {
//     const text = await response.text();
//     body = JSON.parse(text);
//   } else if (contentType.includes("text")) {
//     body = await response.text();
//   } else {
//     // Optionally handle binary here
//     // const buffer = await response.body();
//     // body = buffer.toString("base64"); // if you want to store binary safely
//   }
// } catch (err) {
//   console.error("Error reading response body:", err);
// }

//   requestData.response = {
//     status: response.status(),
//     headers,
//     url: response.url(),
//     timestamp: Date.now(),
//     body,
//     contentType,
//   };
//   saveNetworkDataToFile(requestData);
// }

export { registerNetworkEvents, registerDownloadEvent };
