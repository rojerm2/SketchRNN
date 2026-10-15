import { expect, test, type Page } from "@playwright/test";

const fakeUrl = "http://127.0.0.1:4174";
async function ready(page: Page, url = fakeUrl) {
  await page.goto(url);
  await expect(page.getByTestId("status")).toHaveText("Ready to draw");
}

test("controls, step, regeneration, cancellation and keyboard interaction", async ({
  page,
}) => {
  await ready(page);
  const complete = page.getByRole("button", {
    name: "Complete Sketch",
    exact: true,
  });
  await expect(complete).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Generate Again" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Step", exact: true }),
  ).toBeDisabled();
  const example = page.getByRole("button", { name: "Try an example input" });
  await example.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Example input", { exact: true })).toBeVisible();
  await complete.click();
  await expect(page.getByTestId("status")).toHaveText("Generating");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByTestId("status")).toHaveText("Paused");
  const count = Number(await page.getByTestId("step-count").innerText());
  await page.waitForTimeout(200);
  await expect(page.getByTestId("step-count")).toHaveText(
    count.toString().padStart(3, "0"),
  );
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await expect(page.getByTestId("step-count")).toHaveText(
    (count + 1).toString().padStart(3, "0"),
  );
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.getByTestId("status")).toHaveText("Finished");
  const finishedCount = Number(
    await page.getByTestId("step-count").innerText(),
  );
  await page.getByRole("button", { name: "Generate Again" }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const regeneratedCount = Number(
    await page.getByTestId("step-count").innerText(),
  );
  expect(regeneratedCount).toBeLessThan(finishedCount);
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await expect(page.getByTestId("step-count")).toHaveText(
    (regeneratedCount + 1).toString().padStart(3, "0"),
  );
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByTestId("status")).toHaveText("Stopped");
  const slider = page.getByRole("slider", { name: "Temperature" });
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveValue("0.55");
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(complete).toBeDisabled();
  await expect(page.getByTestId("step-count")).toHaveText("000");
  await example.click();
  await complete.click();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page.waitForTimeout(200);
  await expect(page.getByTestId("status")).toHaveText("Ready to draw");
  await expect(page.getByTestId("step-count")).toHaveText("000");
});

test("separate pointer paths preserve lift boundaries and resize coherently", async ({
  page,
}) => {
  await ready(page);
  const canvas = page.getByTestId("sketch-canvas");
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + 30, box.y + 30);
  await expect(
    page.getByRole("button", { name: "Complete Sketch", exact: true }),
  ).toBeDisabled();
  for (const shift of [0, 70]) {
    await page.mouse.move(box.x + 130 + shift, box.y + 110);
    await page.mouse.down();
    await page.mouse.move(box.x + 150 + shift, box.y + 70, { steps: 6 });
    await page.mouse.move(box.x + 170 + shift, box.y + 110, { steps: 6 });
    await page.mouse.up();
  }
  await page.locator("summary").click();
  await expect(page.locator("tbody")).toContainText("Lift");
  const tokens = (await page.locator("tbody").textContent())!;
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator("tbody")).toHaveText(tokens);
  await page
    .getByRole("button", { name: "Complete Sketch", exact: true })
    .click();
  await expect(page.getByTestId("status")).toHaveText("Generating");
  await page.getByRole("button", { name: "Stop", exact: true }).click();
});

test("real checkpoint generates offline in the production build", async ({
  page,
}, testInfo) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (
      url.hostname === "127.0.0.1" ||
      ["blob:", "data:"].includes(url.protocol)
    )
      return route.continue();
    external.push(url.href);
    return route.abort();
  });
  await ready(page, "http://127.0.0.1:4173");
  await page.getByRole("button", { name: "Try an example input" }).click();
  await page
    .getByRole("button", { name: "Complete Sketch", exact: true })
    .click();
  await expect(page.getByTestId("status")).toHaveText("Finished", {
    timeout: 55000,
  });
  const count = Number(await page.getByTestId("step-count").innerText());
  expect(count).toBeGreaterThan(1);
  expect(count).toBeLessThanOrEqual(300);
  await page.locator("summary").click();
  const values = await page
    .locator("tbody tr")
    .evaluateAll((rows) =>
      rows.flatMap((row) =>
        [1, 2].map((i) => Number(row.children[i].textContent)),
      ),
    );
  expect(values.length).toBeGreaterThan(0);
  expect(values.every(Number.isFinite)).toBe(true);
  const purplePixels = await page
    .getByTestId("sketch-canvas")
    .evaluate((canvas: HTMLCanvasElement) => {
      const { data } = canvas
        .getContext("2d")!
        .getImageData(0, 0, canvas.width, canvas.height);
      let count = 0;
      for (let i = 0; i < data.length; i += 4)
        if (
          data[i] > 90 &&
          data[i + 2] > data[i] &&
          data[i + 1] < data[i] &&
          data[i + 3] > 100
        )
          count++;
      return count;
    });
  expect(purplePixels).toBeGreaterThan(30);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("real-model-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Generate Again" }).click();
  await expect(page.getByTestId("status")).toHaveText("Generating");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const before = Number(await page.getByTestId("step-count").innerText());
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await expect(page.getByTestId("step-count")).toHaveText(
    (before + 1).toString().padStart(3, "0"),
  );
  await page.getByRole("button", { name: "Stop", exact: true }).click();
});

test("missing and corrupted model assets show recoverable errors", async ({
  page,
}) => {
  await page.route("**/models/cat.gen.json", (route) =>
    route.fulfill({ status: 404, contentType: "text/plain", body: "missing" }),
  );
  await page.goto("http://127.0.0.1:4173");
  await expect(page.getByTestId("status")).toHaveText("Model error");
  await expect(page.getByRole("alert")).toContainText("prepare:model");
  await expect(
    page.getByRole("button", { name: "Complete Sketch", exact: true }),
  ).toBeDisabled();
  await page.unroute("**/models/cat.gen.json");
  await page.route("**/models/cat.gen.json", (route) =>
    route.fulfill({ contentType: "application/json", body: "[]" }),
  );
  await page.getByRole("button", { name: "Reload model" }).click();
  await expect(page.getByRole("alert")).toContainText("integrity check");
  await page.unroute("**/models/cat.gen.json");
  await page.getByRole("button", { name: "Reload model" }).click();
  await expect(page.getByTestId("status")).toHaveText("Ready to draw");
});

test("laptop, projector, and mobile layouts remain usable", async ({
  page,
}, testInfo) => {
  await ready(page);
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Try an example input" }).click();
    await expect(
      page.getByRole("button", { name: "Complete Sketch", exact: true }),
    ).toBeEnabled();
    await page.screenshot({
      path: testInfo.outputPath(`layout-${viewport.width}.png`),
      fullPage: true,
    });
  }
});
