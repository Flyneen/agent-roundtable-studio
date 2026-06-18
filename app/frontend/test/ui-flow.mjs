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
  await expectVisibleText(page, "java-api-gateway-python-ai-orchestrator");

  await page.fill("textarea[name='problem']", "真实用户流程验收：如何将 AI 赋能到英语教学当中，尤其是硬件条件比较弱的初中学校？");
  await page.fill("textarea[name='background']", "初中、英语、论文；系统必须自动判断需要哪些智能体，补齐教学设计、学习评估、学校落地和隐私边界。");
  await page.fill("input[name='targetOutput']", "教育场景圆桌报告");
  await page.click("button[type='submit']");

  await page.waitForSelector("#taskProfile:not(.empty)", { timeout: 180000 });
  await expectVisibleText(page, "系统组建圆桌");
  await expectVisibleText(page, "真实分析任务画像");
  await expectVisibleText(page, "教学设计");
  await expectVisibleText(page, "学习评估");
  await expectVisibleText(page, "覆盖检查");
  await expectVisibleText(page, "匹配已有");
  await expectVisibleText(page, "运行证据");
  await page.waitForSelector("#runButton:not(.hidden)", { timeout: 180000 });
  await page.screenshot({ path: path.join(screenshotDir, "ui-flow-01-assembly.png"), fullPage: true });

  await page.click("#runButton");
  await page.waitForSelector("#events:not(.empty)", { timeout: 180000 });
  await expectVisibleText(page, "challenge");
  await expectVisibleText(page, "consensus");
  await page.screenshot({ path: path.join(screenshotDir, "ui-flow-02-roundtable.png"), fullPage: true });

  await page.click("[data-view='output']");
  await page.waitForSelector("#report:not(.empty)", { timeout: 180000 });
  await expectVisibleText(page, "圆桌评审报告");
  await expectVisiblePattern(page, /主要质疑|关键质疑/);
  await expectVisibleText(page, "事件索引");
  await page.waitForSelector("#exportButton:not(.hidden)", { timeout: 180000 });
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

async function expectVisiblePattern(page, pattern) {
  const locator = page.getByText(pattern).first();
  await locator.waitFor({ state: "visible", timeout: 15000 });
}
