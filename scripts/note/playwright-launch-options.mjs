import path from "node:path";

const CHROME_APP_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export function getChromeLaunchOptions(overrides = {}) {
  const executablePath = process.env.NOTE_CHROME_EXECUTABLE || CHROME_APP_PATH;
  return {
    executablePath,
    ...overrides,
  };
}

export function getChromePersistentContextOptions(overrides = {}) {
  return getChromeLaunchOptions(overrides);
}
