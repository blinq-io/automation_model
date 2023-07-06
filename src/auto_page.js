import { getContext } from "./init_browser.js";

let context = null;
const navigate = async (path = "") => {
  //console.log("navigate", this.context.environment.baseUrl + this.path);
  await context.stable.goto(context.environment.baseUrl + path);
  await context.stable.waitForPageLoad();
};

const initContext = async (path, doNavigate = true, headless = false) => {
  if (context) {
    return context;
  }
  context = await getContext(null, headless);
  if (doNavigate) {
    await navigate(path);
  }

  return context;
};

export { initContext, navigate };
