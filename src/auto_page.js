import { getContext } from "./init_browser.js";

let context = null;
const navigate = async (path = "") => {
  let url = null;
  if (path === null) {
    url = context.environment.baseUrl;
  } else {
    url = new URL(path, context.environment.baseUrl).href;
  }
  await context.stable.goto(url);
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
