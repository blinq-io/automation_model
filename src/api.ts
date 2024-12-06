import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { existsSync, readFileSync } from "fs";
import path from "path";
import tunnel, { ProxyOptions } from "tunnel";
import objectPath from "object-path";
import { _commandFinally, _reportToWorld } from "./command_common.js";
import { getHumanReadableErrorMessage } from "./error-messages.js";

interface Config {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD";
  headers: { key: string; value: string; enabled: boolean }[];
  bodyType: "raw" | "none";
  body: string;
  queryParams: { key: string; value: string }[];
  settings: {
    removeRefererHeader: boolean;
    strictHttpParser: boolean;
    encodeUrl: boolean;
    disableCookieJar: boolean;
    useServerCipherSuite: boolean;
    maxRedirects: number;
  };
  tests:
    | {
        pattern: string;
        value: string | number | boolean;
        operator: "eq" | "ne" | "gt" | "lt" | "gte" | "lte" | "mat";
        pass: boolean;
        fail?: boolean;
      }[]
    | null
    | undefined;
  tokens: { token: string; username: string; password: string };
  authType: "Bearer" | "Basic" | "None";
  isStaticToken: boolean;
  status: number;
}
interface Param {
  [key: string]: string;
}

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
  public async request<T = any>(
    config: Config,
    params: Param,
    testData: any,
    world: any
  ): Promise<AxiosResponse<T, any>> {
    // return await this.axiosClientRequest<T>(config);
    const startTime = Date.now();
    let result: any = null;

    const state: any = {
      startTime,
      params,
      testData,
      world,
      element_name: "API",
      type: "api_test",
      text: `Api test`,
      info: {},
    };

    const info = {
      tests: config.tests,
      testsPassed: 0,
      failCause: {},
    };
    state.info = info;

    let error: any = null;
    const fixedUrl = repStrWParamTData(config.url, params, testData);
    const fixedQueryParams = config.queryParams.map((param) => {
      return {
        key: repStrWParamTData(param.key, params, testData),
        value: repStrWParamTData(param.value, params, testData),
      };
    });
    const fixedReqHeaders = config.headers.map((header) => {
      return {
        key: repStrWParamTData(header.key, params, testData),
        value: repStrWParamTData(header.value, params, testData),
        enabled: header.enabled,
      };
    });
    if (config.authType === "Bearer") {
      //@ts-ignore
      config.tokens.token = repStrWParamTData(config.tokens.token, params, testData);
    } else if (config.authType === "Basic") {
      //@ts-ignore
      config.tokens.username = repStrWParamTData(config.tokens.username, params, testData);
      //@ts-ignore
      config.tokens.password = repStrWParamTData(config.tokens.password, params, testData);
    }
    const formattedUrl =
      fixedQueryParams.filter((data) => !!data.key).length > 0
        ? `${fixedUrl}?${fixedQueryParams.map((data) => `${data.key}=${data.value}`).join("&")}`
        : fixedUrl;

    const axiosConfig = {
      method: config.method,
      url: formattedUrl,
      headers: fixedReqHeaders.reduce((acc: { [key: string]: string }, header) => {
        if (header.enabled && header.key.length > 0) acc[header.key] = header.value;
        return acc;
      }, {}),
      data: config.bodyType === "raw" ? config.body : undefined,
      maxRedirects: config.settings.maxRedirects,
      validateStatus: config.settings.strictHttpParser ? (status: any) => status >= 200 && status < 300 : null,
    };
    if (config.authType === "Bearer") {
      //@ts-ignore
      axiosConfig.headers["Authorization"] = `Bearer ${config.tokens.token}`;
    } else if (config.authType === "Basic" && config.tokens.username && config.tokens.password) {
      //@ts-ignore
      axiosConfig.headers["Authorization"] = `Basic ${btoa(`${config.tokens.username}:${config.tokens.password}`)}`;
    }

    // const tests = config.tests;
    // let testsPassed = 0;
    let res: any = {};
    try {
      res = await this.axiosClientRequest<T>(axiosConfig);
      if (res.status != config.status) {
        throw new Error(`The returned status code ${res.status} doesn't match the saved status code ${config.status}`);
      }
      if (info.tests) {
        info.tests?.forEach((test) => {
          test.fail = true;
          const receivedValue = getValue(res.data, test.pattern);
          if (!hasValue(receivedValue)) {
            throw new Error(`The path ${test.pattern} does not exist in the response`);
          }
          switch (test.operator) {
            case "eq":
              test.fail = receivedValue != test.value;
              break;
            case "ne":
              test.fail = receivedValue == test.value;
              break;
            case "gt":
              test.fail = receivedValue <= test.value;
              break;
            case "lt":
              test.fail = receivedValue >= test.value;
              break;
            case "gte":
              test.fail = receivedValue < test.value;
              break;
            case "lte":
              test.fail = receivedValue > test.value;
              break;
            case "mat":
              test.fail = !new RegExp(test.value as string).test(receivedValue);
              break;
            default:
              test.fail = true;
              break;
          }
        });

        const testsFailed = info.tests.filter((test) => test.fail);
        info.testsPassed = info.tests.length - testsFailed.length;

        state.info.headers = res.headers;
        state.info.status = res.status;
        state.info.data = res.data;
        if (testsFailed.length > 0) {
          throw new Error("Tests failed");
        }
      }
      return res;
    } catch (e) {
      error = e;
      process.env.NO_RETRAIN = "false";
      this.logger.error("Error while sending request " + error.message ? error.message : error.code);
      error.stack = "";
      state.info.failCause.fail = true;
      const errorClassification = getHumanReadableErrorMessage(error, state.info);
      state.info.errorType = errorClassification.errorType;
      state.info.errorMessage = errorClassification.errorMessage;

      Object.assign(error, { info: state.info });
      state.error = error;
      state.commandError = true;
      throw error;
    } finally {
      const statusText = res.statusText ? res.statusText : error ? error.code : null;
      state.info.statusText = statusText;
      _commandFinally(state, this);
    }
  }
  async requestWithAuth(methodName: string, world: any, token: string, params: any) {
    const startTime = Date.now();
    let error: any = null,
      // tests: any = {},
      res: any = null;
    // testsPassed = 0;

    const state: any = {
      startTime,
      params,
      world,
      element_name: "API",
      type: "api_test",
      text: `Api test for ${methodName}`,
      info: {},
    };
    const apiFilePath = path.join("./features", "apis", methodName + ".json");
    let result = null;
    if (existsSync(apiFilePath)) {
      try {
        const apiRequests = JSON.parse(readFileSync(apiFilePath, "utf8"));
        const info = {
          tests: apiRequests.tests,
          testsPassed: 0,
          failCause: {},
        };
        state.info = info;
        const useAuthHeaders = apiRequests.useAuthHeaders;
        const config = JSON.parse(apiRequests.config);
        if (useAuthHeaders) {
          config.headers = {
            ...config.headers,
            Authorization: token,
          };
        }
        res = await this.axiosClientRequest(JSON.parse(apiRequests.config));
        info.tests = apiRequests.tests;
        info.tests?.forEach((test: any) => {
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
          test.receivedValue = value;
        });
        const statusCode = config.status || 200;
        if (res.status != statusCode) {
          throw new Error(`The returned status code ${res.status} doesn't match the saved status code ${statusCode}`);
        }
        const testsFailed = info.tests.filter((test: any) => test.fail);
        info.testsPassed = info.tests.length - testsFailed.length;
        state.info.headers = res.headers;
        state.info.status = res.status;
        state.info.data = res.data;
        if (testsFailed.length > 0) {
          throw new Error("Tests failed");
        }
        return res;
      } catch (e) {
        error = e;
        process.env.NO_RETRAIN = "false";
        this.logger.error("Error while sending request " + error.message ? error.message : error.code);
        error.stack = "";
        state.info.failCause.fail = true;
        const errorClassification = getHumanReadableErrorMessage(error, state.info);
        state.info.errorType = errorClassification.errorType;
        state.info.errorMessage = errorClassification.errorMessage;

        Object.assign(error, { info: state.info });
        state.error = error;
        state.commandError = true;
        if (error?.stack) {
          error.stack = "";
        }
        throw error;
      } finally {
        const statusText = res.statusText ? res.statusText : error ? error.code : null;
        state.info.statusText = statusText;
        _commandFinally(state, this);
      }
    }
  }
}

const repStrWParamTData = (str: string, params: Param, testData: any) => {
  let newStr = str;
  Object.keys(params).forEach((key) => {
    newStr = newStr.replaceAll(`"<${key.slice(1)}>"`, params[key]);
  });
  Object.keys(testData).forEach((key) => {
    newStr = newStr.replaceAll(`{{${key}}}`, testData[key]);
  });
  return newStr;
};

const getValue = (data: any, pattern: string): any => {
  const path = pattern.split(".");
  let lengthExists = false;
  if (path[path.length - 1] === "length") {
    path.pop();
    lengthExists = true;
  }
  const value = objectPath.get(data, pattern);
  if (lengthExists && Array.isArray(value)) {
    return value?.length;
  } else if (hasValue(value)) {
    return value;
  }

  return null;
};
const hasValue = (value: any) => {
  return value !== null && value !== undefined;
};
export { Api };
