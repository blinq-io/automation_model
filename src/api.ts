import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { existsSync, readFileSync } from "fs";
import path from "path";
import tunnel, { ProxyOptions } from "tunnel";
import objectPath from "object-path";

class Api {
  private axiosClient: AxiosInstance;
  constructor(public logger: any) {
    if (!logger) {
      this.logger = console;
    }
    const agent = this.getProxyObject(process.env.PROXY);
    if (agent) {
      this.logger.debug("proxy object");
      this.logger.debug(agent);
    }
    this.axiosClient = axios.create({
      httpsAgent: agent,
      proxy: false,
    });
  }
  getProxyObject(proxy?: string) {
    if (!proxy) {
      proxy = process.env.PROXY;
    }
    if (!proxy) {
      return null;
    }

    try {
      const url = new URL(proxy);
      const proxyObject: ProxyOptions = {
        host: url.hostname,
        port: Number(url.port),
      };

      const { username, password } = url;

      if (username && password) {
        proxyObject.proxyAuth = `${username}:${password}`;
      }
      return tunnel.httpsOverHttp({ proxy: proxyObject });
    } catch (error) {
      this.logger.error("Error while parsing proxy url");
      this.logger.error(error);
      return null;
    }
  }

  public async axiosClientRequest<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T, any>> {
    for (let i = 0; i < 2; i++) {
      try {
        const res = this.axiosClient<T>(config);
        // this.logger.info("axios response");
        // this.logger.info(res);
        return res;
      } catch (error: any) {
        this.logger.info("axios error");
        this.logger.info(error);
        if (i === 1) {
          this.logger.error("Error while sending request " + error.message);
          throw error;
        }

        if (
          (error.response && error.response.data.includes("self signed certificate")) ||
          (error.message && error.message.includes("self signed certificate"))
        ) {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
          this.logger.info("NODE_TLS_REJECT_UNAUTHORIZED = " + process.env.NODE_TLS_REJECT_UNAUTHORIZED);
        }
      }
    }
    this.logger.debug("axios request");
    this.logger.debug(config);
    throw new Error("Request failed after 2 attempts"); // Throw an error or return a value explicitly here
  }
  public setProxy(proxy?: string) {
    const agent = this.getProxyObject(proxy);
    this.logger.info(agent);
    this.axiosClient = axios.create({ proxy: false, httpsAgent: agent });
  }
  public async request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T, any>> {
    return await this.axiosClientRequest<T>(config);
  }
  async requestWithAuth(
    methodName: string,
    world: any,
    token: string,
    params: any
  ) {
    const startTime = Date.now();
    let error = null,
      tests: any = {},
      res: any = null,
      testsPassed = 0;
    const apiFilePath = path.join("./features", "apis", methodName + ".json");
    if (existsSync(apiFilePath)) {
      try {
        const apiRequests = JSON.parse(readFileSync(apiFilePath, "utf8"));
        const useAuthHeaders = apiRequests.useAuthHeaders;
        const config = JSON.parse(apiRequests.config);
        if (useAuthHeaders) {
          config.headers = {
            ...config.headers,
            Authorization: token,
          };
        }
        res = await this.axiosClientRequest(JSON.parse(apiRequests.config));
        if (res.status != 200) {
          throw new Error("Request failed with status code " + res.status);
        }
        tests = apiRequests.tests;
        tests?.forEach((test: any) => {
          test.fail = true;
          const path = test === null || test === void 0 ? void 0 : test.pattern.split(".");
          let lengthExists = false;
          if (path[path.length - 1] === "length") {
            path.pop();
            lengthExists = true;
          }
          const value = objectPath.get(res.data, path.join("."));
          if (lengthExists && value?.length == test.value) {
            test.fail = false;
          } else if (Array.isArray(value)) {
            test.fail = test.value != "exists";
          } else if (value == test.value) {
            test.fail = false;
          }
          if (test.fail) {
            test.newValue = value;
            throw new Error("Test failed");
          }
        });
        const testsFailed = tests.filter((test: any) => test.fail);
        testsPassed = tests.length - testsFailed.length;
        if (testsFailed.length > 0) {
          throw new Error("Tests failed");
        }
        return res.data;
      } catch (e) {
        error = e;
        throw error;
      } finally {
        const endTime = Date.now();
        const properties = {
          element_name: "API",
          type: "api_test",
          text: `Api test for ${methodName}`,
          result: error
            ? {
                status: "FAILED",
                startTime,
                endTime,
              }
            : {
                status: "PASSED",
                startTime,
                endTime,
              },
          info: { tests, testsPassed, headers: res.headers },
        };
        if (world && world.attach) {
          world.attach(JSON.stringify(properties), {
            mediaType: "application/json",
          });
        }
        return null;
      }
    }
  }
}

export { Api };
