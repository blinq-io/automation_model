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
          saveNetworkData();
        } else {
          console.error("No data found for request ID", requestId);
        }
      });

      // Event listener for when a request fails
      page.on("requestfailed", (request: any) => {
        const requestId = request.requestId;
        const endTime = Date.now();
        const startTime = requestTimes.get(requestId);

        // Find the corresponding data object
        const data = networkData.find((item: any) => item.requestId === requestId);

        if (data) {
          data.responseEnd = endTime;
          data.responseTime = endTime - startTime;
          data.status = "Failed";
          data.size = 0;
          saveNetworkData();
        } else {
          console.error("No data found for request ID", requestId);
        }
      });
    }
  } else {
    console.error("No page found to register network events");
  }
}
export { registerNetworkEvents };