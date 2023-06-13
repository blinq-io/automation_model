import { getContext } from "./init_browser.js";
import { StableBrowser } from "./stable_browser.js";
class AutoPage {
  constructor() {
    this.name = null;
    this.path = null;
    this.elements = {};
    this.context = null;
    this.login_required = false;
    this.url_navigate = true;
    this.stable = null;
  }

  /**
   * Add element to the elements dictionary
   * @param {string} name - Name of the element
   * @param {string} locator - Locator of the element
   * @returns {void}
   * @memberof Page
   * @example
   * page.addElement('username', 'input[name="username"]');
   */
  addElement(name, locator) {
    this.elements[name] = locator;
  }
  /**
   * init context
   */
  static async init(navigate = true, headless = false) {
    const instance = new this();
    instance.context = await getContext(null, headless);
    instance.page = instance.context.page;
    instance.browser = instance.context.browser;
    instance.stable = instance.context.stable;
    if (navigate) {
      await instance.navigate();
    }
    return instance;
  }
  static async initFromContext(context, navigate = true) {
    const instance = new this();
    instance.context = context;
    instance.page = instance.context.page;
    instance.browser = instance.context.browser;
    instance.environment = instance.context.environment;
    instance.stable = instance.context.stable;
    if (navigate) {
      await instance.navigate();
    }
    return instance;
  }

  /**
   * Navigate to the page
   * synchronize waiting the page to be loaded
   * @param {Environment} environment - Environment object
   */
  async navigate() {
    //console.log("navigate", this.context.environment.baseUrl + this.path);
    await this.stable.goto(this.context.environment.baseUrl + this.path);
    await this.stable.waitForPageLoad();
  }
}
export { AutoPage };
