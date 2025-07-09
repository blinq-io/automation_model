import path from "path";
import fs from "fs";
import { _stepNameToTemplate } from "./route.js";
import crypto from "crypto";

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
  const networkFile = _getNetworkFile(world, web, context);
  function saveNetworkData() {
    if (context && context.networkData) {
      fs.writeFileSync(networkFile, JSON.stringify(context.networkData, null, 2), "utf8");
    }
  }
  if (!context) {
    console.error("No context found to register network events");
    return;
  }
  // Map to hold request start times and IDs
  const requestTimes = new Map();
  let requestIdCounter = 0;

  if (page) {
    if (!context.networkData) {
      context.networkData = [];
      const networkData = context.networkData;
      // Event listener for when a request is made
      page.on("request", (request: any) => {
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
      });

      // Event listener for when a response is received
      page.on("response", async (response: any) => {
        const request = response.request();
        const requestId = request.requestId;
        const receivedTime = Date.now();

        // Find the corresponding data object
        const data = networkData.find((item: any) => item.requestId === requestId);

        if (data) {
          data.status = response.status();
          data.responseReceived = receivedTime;
          saveNetworkData();
        } else {
          console.error("No data found for request ID", requestId);
        }
      });

      // Event listener for when a request is finished
      page.on("requestfinished", async (request: any) => {
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
            const body = await response.body();
            data.size = body.length;
          } catch (e) {
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
          console.error("No data found for request ID", requestId);
        }
      });

      // Event listener for when a request fails
      page.on("requestfailed", async (request: any) => {
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
            console.error("No data found for request ID", requestId);
          }
        } catch (error) {
          // ignore
        }
      });
    }
  } else {
    console.error("No page found to register network events");
  }
}

interface ExecutionState {
  currentStepHash: string | null;
  liveRequestsMap: Map<any, any>;
}
const storeDetailedNetworkData = process.env.STORE_DETAILED_NETWORK_DATA === "true";
const detailedNetworkFolder = "temp/detailed_network_data";
const executionState = {
  currentStepHash: null,
  liveRequestsMap: new Map<any, any>(),
} as ExecutionState;

export function networkBeforeStep(stepName: string) {
  if (!storeDetailedNetworkData) {
    return;
  }
  // check if the folder exists, if not create it
  if (!fs.existsSync(detailedNetworkFolder)) {
    fs.mkdirSync(detailedNetworkFolder, { recursive: true });
  }
  const stepHash = stepNameToHash(stepName);
  // check if the file exists, if exists delete it
  const networkFile = path.join(detailedNetworkFolder, `${stepHash}.json`);
  if (fs.existsSync(networkFile)) {
    fs.unlinkSync(networkFile);
  }
  executionState.currentStepHash = stepHash;
}

export function networkAfterStep(stepName: string) {
  if (!storeDetailedNetworkData) {
    return;
  }
  executionState.currentStepHash = null;
}
function stepNameToHash(stepName: string): string {
  const templateName = _stepNameToTemplate(stepName);
  // create hash from the template name
  return crypto.createHash("sha256").update(stepName).digest("hex");
}
function handleRequest(request: any) {
  if (!storeDetailedNetworkData || !executionState.currentStepHash) {
    return;
  }
  const requestId = request.requestId;
  const requestData = {
    requestId,
    url: request.url(),
    method: request.method(),
    headers: request.headers(),
    postData: request.postData(),
    timestamp: Date.now(),
    stepHash: executionState.currentStepHash,
  };
  executionState.liveRequestsMap.set(request, requestData);
}
function saveNetworkDataToFile(requestData: any) {
  if (!storeDetailedNetworkData) {
    return;
  }
  const networkFile = path.join(detailedNetworkFolder, `${requestData.stepHash}.json`);
  // read the existing data if it exists (should be an array)
  let existingData = [];
  if (fs.existsSync(networkFile)) {
    const data = fs.readFileSync(networkFile, "utf8");
    try {
      existingData = JSON.parse(data);
    } catch (e) {
      console.error("Failed to parse existing network data:", e);
    }
  }
  // Add the live requests to the existing data
  existingData.push(requestData);
  // Save the updated data back to the file
  fs.writeFileSync(networkFile, JSON.stringify(existingData, null, 2), "utf8");
}
async function handleRequestFinishedOrFailed(request: any, failed: boolean) {
  if (!storeDetailedNetworkData) {
    return;
  }

  const response = await request.response(); // This may be null if the request failed
  const requestData = executionState.liveRequestsMap.get(request);
  if (!requestData) {
    //console.warn("No request data found for request", request);
    return;
  }
  // Remove the request from the live requests map
  executionState.liveRequestsMap.delete(request);

  if (failed || !response) {
    // Handle failed request
    requestData.response = {
      status: null,
      headers: {},
      timing: null,
      url: request.url(),
      timestamp: Date.now(),
      body: null,
      contentType: null,
      error: "Request failed",
    };
    saveNetworkDataToFile(requestData);
    return;
  }

  // Handle successful request with a response
  const headers = response.headers();
  const contentType = headers["content-type"] || "";
  let body = null;

  try {
    if (contentType.includes("application/json")) {
      const text = await response.text();
      body = JSON.parse(text);
    } else if (contentType.includes("text")) {
      body = await response.text();
    } else {
      // Optionally handle binary here
      // const buffer = await response.body();
      // body = buffer.toString("base64"); // if you want to store binary safely
    }
  } catch (err) {
    console.error("Error reading response body:", err);
  }

  requestData.response = {
    status: response.status(),
    headers,
    url: response.url(),
    timestamp: Date.now(),
    body,
    contentType,
  };
  saveNetworkDataToFile(requestData);
}

export { registerNetworkEvents, registerDownloadEvent };
