export function check_performance(context: any, name: string, start: boolean = false): void {
  if (!context) {
    return;
  }
  if (!context.profile) {
    return;
  }
  const profile = context.profile;
  let aggrigate = false;
  if (name.endsWith("+")) {
    aggrigate = true;
    name = name.slice(0, -1);
  }
  if (start === true) {
    // check if key exists
    let key = name;
    let i = 1;
    if (!aggrigate) {
      while (profile[key]) {
        key = name + i;
        i++;
      }
      profile[key] = Date.now();
    } else {
      if (!profile[key]) {
        profile[key] = [0, Date.now(), 0];
      } else {
        profile[key][1] = Date.now();
        profile[key][2] = profile[key][2] + 1;
      }
    }
  } else {
    let key = name;
    // find the last existing key
    if (!aggrigate) {
      let i = 1;
      let lastKey = name;
      while (profile[key]) {
        lastKey = key;
        key = name + i;
        i++;
      }
      if (profile[lastKey]) {
        profile[lastKey] = (Date.now() - profile[lastKey]) / 1000;
      }
    } else {
      if (profile[key]) {
        profile[key][0] += (Date.now() - profile[key][1]) / 1000;
      }
    }
  }
}
