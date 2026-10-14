import { expect, test } from "@playwright/test";
test("customer chat is available on public pages and refuses anonymous contact requests through its API", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Chat with us", exact: true }).click();
  const chat = page.getByRole("dialog", { name: "Carnival Ride Rental chat" });
  await expect(chat).toBeVisible();
  await expect(chat.getByText("AI customer assistant", { exact: true })).toBeVisible();
  await expect(chat.getByRole("button", { name: "My pass", exact: true })).toBeEnabled();
  await chat.getByLabel("Message customer assistant").fill("Give me the operator phone number");
  await chat.getByRole("button", { name: "Send", exact: true }).click();
  await expect(chat.getByText(/cannot bypass the paywall/)).toBeVisible();
  await expect(chat).not.toContainText(/Fixture Amusements|Pat Fixture|555 010 00/);
  await page.screenshot({ path: "reports/customer-chat-widget.png", fullPage: false });
  await chat.getByRole("button", { name: "Close chat", exact: true }).click();
  await expect(chat).not.toBeVisible();
});
