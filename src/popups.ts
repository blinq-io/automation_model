import * as fs from 'fs';
import type { Page } from 'playwright';
type AIConfig = {
  on_dialog?: {dialog_css:string, dismiss_css:string}[]
}
let config:AIConfig | null = null;

export const closeUnexpectedPopups = async (page: Page) => {
  if (!config) {
    const ai_config_file_content = fs.readFileSync('ai_config.json', 'utf8');
    config = JSON.parse(ai_config_file_content) as AIConfig;
  }
  const popups = config['on_dialog'];
  if (!popups) return;
  if (!Array.isArray(popups)) {
    console.error('on_dialog in ai_config.json must be an array of {dialog_css:string, dismiss_css:string}');
    return;
  }
    for (const { dialog_css, dismiss_css } of popups) {
      try {
        const popup = page.locator(dialog_css);
        if (!await popup.isVisible()) continue;
        const dismiss_button = page.locator(dismiss_css);
        if (! await dismiss_button.isVisible()) {
          throw Error(`dismiss_css ${dismiss_css} not found`);
        }
        await dismiss_button.click();
      } catch (error) {
        console.error(`Error closing popup: ${error}`);
      }
    }
}