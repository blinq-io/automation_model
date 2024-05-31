import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import tunnel, { ProxyOptions } from "tunnel";
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

  public async axiosClientRequest<T = any>(
    config: AxiosRequestConfig
  ): Promise<AxiosResponse<T, any>> {
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
          (error.response &&
            error.response.data.includes("self signed certificate")) ||
          (error.message && error.message.includes("self signed certificate"))
        ) {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
          this.logger.info(
            "NODE_TLS_REJECT_UNAUTHORIZED = " +
              process.env.NODE_TLS_REJECT_UNAUTHORIZED
          );
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
    config: AxiosRequestConfig
  ): Promise<AxiosResponse<T, any>> {
    return await this.axiosClientRequest<T>(config);
  }
  public async requestWithAuth<T = any>(
    config: AxiosRequestConfig,
    authType: string,
    additionalData?: any
  ): Promise<AxiosResponse<T, any>> {
    if (authType === "Auth Header") {
      config.headers = {
        ...config.headers,
        Authorization: additionalData.authToken,
      };
    }
    return await this.axiosClientRequest<T>(config);
  }
}

export { Api };
