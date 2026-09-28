import { expect, test } from "@playwright/test";
import { appConfig } from "@/config/app";

test("home page shows the app name", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(appConfig.name);
  await expect(
    page.getByRole("heading", { level: 1, name: appConfig.name }),
  ).toBeVisible();
});
