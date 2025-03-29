# Stable API Description

This API is built on top of Playwright to control browsers. The most common commands are:

- `click`
- `clickType`
- `verifyTextExistInPage`

## Parameters

- **selectors** - An object that can contain the name of the element as well as multiple selectors (CSS, ARIA, etc.) used to locate the element.
- **world** - Used as part of `cucumber-js`.
- **\_params** - An object that includes the original function parameters (used in dynamic selectors).
- **options** - Can be used to set the timeout (`{timeout: 30000}` is the default).
- **climb** - After finding the element using the selectors, will climb the DOM.

Unless stated otherwise, the APIs will return an information object and will throw an error in case of failure.

## Function List

```javascript
async goto(url: string, world);
/* Use AI to identify an element and click on it */
async simpleClick(elementDescription, _params, options = {}, world);
async simpleClickType(elementDescription, value, _params, options = {}, world);
async click(selectors, _params, options = {}, world);
/* Return true/false */
async waitForElement(selectors, _params, options = {}, world);
async setCheck(selectors, checked = true, _params, options = {}, world);
async hover(selectors, _params, options = {}, world);
async selectOption(selectors, values, _params, options = {}, world);
async type(_value, _params, options = {}, world);
async setDateTime(selectors, value, format, enter = false, _params, options = {}, world);
/* Use to populate text fields */
async clickType(selectors, _value, enter = false, _params, options = {}, world);
/* Return the text */
async _getText(selectors, climb, _params, options = {}, info, world);
async containsText(selectors, text, climb, _params, options = {}, world);
setTestData(testData, world);
getTestData(world);
async verifyElementExistInPage(selectors, _params, options = {}, world);
async extractAttribute(selectors, attribute, variable, _params, options = {}, world);
async verifyAttribute(selectors, attribute, value, _params, options = {}, world);
async verifyPagePath(pathPart, options = {}, world);
async verifyTextExistInPage(text, options = {}, world);
async waitForTextToDisappear(text, options = {}, world);
async verifyTextRelatedToText(textAnchor, climb, textToVerify, options = {}, world);
async visualVerification(text, options = {}, world);
async waitForPageLoad(options = {}, world);
async closePage(options = {}, world);
saveTestDataAsGlobal(options, world);
async setViewportSize(width, height, options = {}, world);
async reloadPage(options = {}, world);
/* Return the ARIA snapshot as string */
async getAriaSnapshot();
```

## Code Use Cases

### Original Function

```javascript
async function login_with_user_and_password(_username, _password) {
  const _params = { _username, _password };
  // Fill Username textbox with "_username"
  await context.web.clickType(elements["textbox_username"], _username, false, _params, null, this);
  // Fill Password textbox with "_password"
  await context.web.clickType(elements["textbox_password"], _password, false, _params, null, this);
  // Click on Login button
  await context.web.click(elements["button_login"], _params, null, this);
}
```

### Example 1: Continue execution if step fails

```javascript
async function login_with_user_and_password(_username, _password) {
  const _params = { _username, _password };
  try {
    await context.web.clickType(elements["textbox_username"], _username, false, _params, null, this);
    await context.web.clickType(elements["textbox_password"], _password, false, _params, null, this);
    await context.web.click(elements["button_login"], _params, null, this);
  } catch (error) {}
}
```

### Example 2: Perform action only if "textbox_username" is found

```javascript
async function login_with_user_and_password(_username, _password) {
  const _params = { _username, _password };
  if (await context.web.waitForElement(elements["textbox_username"], _params, { timeout: 4000 }, this)) {
    await context.web.clickType(elements["textbox_username"], _username, false, _params, null, this);
    await context.web.clickType(elements["textbox_password"], _password, false, _params, null, this);
    await context.web.click(elements["button_login"], _params, null, this);
  }
}
```

### Example 3: Retry step if it fails

```javascript
async function login_with_user_and_password(_username, _password) {
  const _params = { _username, _password };
  const maxRetry = 2;
  for (let i = 0; i < maxRetry; i++) {
    try {
      await context.web.clickType(elements["textbox_username"], _username, false, _params, null, this);
      await context.web.clickType(elements["textbox_password"], _password, false, _params, null, this);
      await context.web.click(elements["button_login"], _params, null, this);
      break;
    } catch (error) {
      if (i === maxRetry - 1) {
        throw error;
      }
    }
  }
}
```

### Example 4: Set click timeout to 2 minutes

```javascript
async function login_with_user_and_password(_username, _password) {
  const _params = { _username, _password };
  await context.web.clickType(elements["textbox_username"], _username, false, _params, { timeout: 120000 }, this);
  await context.web.clickType(elements["textbox_password"], _password, false, _params, { timeout: 120000 }, this);
  await context.web.click(elements["button_login"], _params, { timeout: 120000 }, this);
}
```
