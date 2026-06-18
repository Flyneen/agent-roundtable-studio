import fs from "node:fs";
import path from "node:path";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:8787";
const screenshotDir = path.resolve("frontend/test-output");
fs.mkdirSync(screenshotDir, { recursive: true });

const { chromium } = await importPlaywright();
const browser = await chromium.launch({
  headless: process.env.HEADLESS !== "0"
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 }
});

try {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await expectVisibleText(page, "让系统自动组建圆桌");
  await expectVisibleText(page, "Runtime:");

  await page.fill("textarea[name='problem']", "真实用户流程验收：医疗健康产品上线评审，使用者不知道需要哪些智能体，系统必须自动组建圆桌并补齐合规、行业专家和财务审计视角。");
  await page.fill("textarea[name='background']", "这是从公网 Web 页面发起的真实用户路径，不直接调用 API。需要看到任务画像、系统组建过程、覆盖检查、结构化圆桌事件和最终报告。");
  await page.fill("input[name='targetOutput']", "真实用户流程验收报告");
  await page.click("button[type='submit']");

  await page.waitForSelector("#taskProfile:not(.empty)", { timeout: 15000 });
  await expectVisibleText(page, "系统组建圆桌");
  await expectVisibleText(page, "识别问题所需视角");
  await expectVisibleText(page, "覆盖检查");
  await expectVisibleText(page, "匹配已有");
  await page.waitForSelector("#runButton:not(.hidden)", { timeout: 15000 });
  await page.screenshot({ path: path.join(screenshotDir, "ui-flow-01-assembly.png"), fullPage: true });

  await page.click("#runButton");
  await page.waitForSelector("#events:not(.empty)", { timeout: 15000 });
  await expectVisibleText(page, "challenge");
  await expectVisibleText(page, "consensus");
  await page.screenshot({ path: path.join(screenshotDir, "ui-flow-02-roundtable.png"), fullPage: true });

  await page.click("[data-view='output']");
  await page.waitForSelector("#report:not(.empty)", { timeout: 15000 });
  await expectVisibleText(page, "圆桌评审报告");
  await expectVisibleText(page, "主要质疑");
  await expectVisibleText(page, "事件索引");
  await page.waitForSelector("#exportButton:not(.hidden)", { timeout: 15000 });
  await page.screenshot({ path: path.join(screenshotDir, "ui-flow-03-report.png"), fullPage: true });

  console.log(`UI flow passed: ${baseUrl}`);
} finally {
  await browser.close();
}

async function importPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    throw new Error(`Playwright is required for UI flow testing. Run: npm install --no-save playwright. ${error.message}`);
  }
}

async function expectVisibleText(page, text) {
  const locator = page.getByText(text, { exact: false }).first();
  await locator.waitFor({ state: "visible", timeout: 15000 });
}
