type Cookie = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number | string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
};

type LocalStorage = Record<string, string>;

class Environment {
  cookies: Cookie[] = [];
  origins: { origin: string; localStorage: LocalStorage }[] = [];
  extensionPath?: string;
  constructor(public baseUrl?: string) {}
  setBaseUrl(url: string) {
    this.baseUrl = url;
  }
}
export { Environment };
export type { Cookie, LocalStorage };
