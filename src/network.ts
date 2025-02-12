import path from "path";
import fs from "fs";
function _getNetworkFile(world: any = null, stable: any = null, context: any = null) {
  let networkFile = null;
  if (world && world.reportFolder) {
    networkFile = path.join(world.reportFolder, "network.json");
  } else if (stable.reportFolder) {
    networkFile = path.join(stable.reportFolder, "network.json");
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
function registerNetworkEvents(world: any, stable: any, context: any, page: any) {
  const networkFile = _getNetworkFile(world, stable, context);
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
      });
    }
  } else {
    console.error("No page found to register network events");
  }
}
export { registerNetworkEvents, registerDownloadEvent };
