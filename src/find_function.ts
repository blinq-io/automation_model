const find_function = async (funcs: Function[]) => {
  if (!funcs || funcs.length === 0) {
    return null;
  }
  let baseFunc = null;
  for (const func of funcs) {
    if (!func.name.includes("__")) {
      baseFunc = func;
      break;
    }
  }
  if (!baseFunc) {
    baseFunc = funcs[0];
  }
  const breakpointText = process.env.BREAKPOINT;
  if (!breakpointText) {
    return baseFunc;
  }
  const functionName = baseFunc.name;
  const baseName = functionName.split("__")[0];
  //   if (functionName === baseName) {
  //     return func;
  //   }

  const breakpoints = breakpointText.split(",");

  let index = -1;
  let maxMatchs = 0;
  for (let i = 0; i < funcs.length; i++) {
    const func = funcs[i];
    const functionName = func.name;
    if (functionName.indexOf("__") === -1) {
      continue;
    }
    const functionBreakpoints = functionName.split("__")[1].split("_");
    let count = 0;
    for (const breakpoint of breakpoints) {
      if (functionBreakpoints.includes(breakpoint)) {
        count++;
      }
    }
    if (count > maxMatchs) {
      maxMatchs = count;
      index = i;
    }
  }
  if (index === -1) {
    return baseFunc;
  }
  return funcs[index];
};

export { find_function };
