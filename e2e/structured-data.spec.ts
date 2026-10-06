import { expect, test } from "@playwright/test";

/**
 * Every public template carries ONE connected JSON-LD graph:
 * Organization + WebSite + operator-side Service (site-wide), then the page's WebPage, customer
 * Service and — only when visible — BreadcrumbList, ItemList and FAQPage.
 */
const PAGES = [
  "/",
  "/rides",
  "/rides/ferris-wheel-rental",
  "/texas",
  "/texas/austin",
  "/texas/austin/ferris-wheel-rental",
  "/ohio/company-picnics",
  "/events",
  "/events/weddings",
  "/categories/swing-rides",
  "/operators",
  "/connect",
];
const PRICED = ["/rides/ferris-wheel-rental", "/texas", "/ohio/company-picnics", "/events/weddings", "/categories/swing-rides"];

type Node = Record<string, unknown> & { "@type": string; "@id"?: string };

test("every public page: one connected graph, both audiences, no prices or ratings, visible-crumb match", async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(scripts, path).toHaveLength(1);
    const doc = JSON.parse(scripts[0]) as { "@context": string; "@graph": Node[] };
    expect(doc["@context"]).toBe("https://schema.org");
    const g = doc["@graph"];
    const types = g.map((n) => n["@type"]);
    for (const t of ["Organization", "WebSite"]) expect(types, `${path} ${t}`).toContain(t);

    // Operator side: one small node, and it is visible in the footer strip.
    const op = g.find((n) => String(n["@id"]).endsWith("/operators#service"))!;
    expect(op, path).toBeTruthy();
    expect(op.audience).toMatchObject({ "@type": "BusinessAudience" });
    await expect(page.getByTestId("operator-strip")).toContainText("Own a carnival ride?");

    // Customer side: the page node, typed, and (except on the operator page) the rental Service with its audience.
    const webPage = g.find((n) => ["WebPage", "CollectionPage", "ItemPage"].includes(n["@type"]))!;
    expect(webPage, path).toBeTruthy();
    expect(webPage.mentions).toEqual({ "@id": op["@id"] });
    if (path !== "/operators" && path !== "/connect" && path !== "/events") {
      const svc = g.find((n) => n["@type"] === "Service" && n !== op)!;
      expect(svc, path).toBeTruthy();
      expect(svc.audience).toMatchObject({ "@type": "Audience", audienceType: "Event organizers" });
      expect(webPage.about).toEqual({ "@id": svc["@id"] });
    }

    // Every @id reference resolves inside the graph.
    const ids = new Set(g.map((n) => n["@id"]));
    for (const r of JSON.stringify(g).match(/\{"@id":"[^"]+"\}/g) ?? []) expect(ids.has(JSON.parse(r)["@id"]), `${path} ${r}`).toBe(true);

    // Breadcrumbs: present in markup only when visible, and identical when they are.
    const crumbNav = page.getByRole("navigation", { name: "Breadcrumb" });
    const crumbNode = g.find((n) => n["@type"] === "BreadcrumbList") as { itemListElement: { name: string }[] } | undefined;
    if ((await crumbNav.count()) > 0) {
      expect(crumbNode, path).toBeTruthy();
      expect(crumbNode!.itemListElement.map((i) => i.name)).toEqual(await crumbNav.getByRole("listitem").allInnerTexts());
    } else {
      expect(crumbNode, path).toBeUndefined();
    }

    expect(scripts[0], path).not.toMatch(/"offers"|"price"|aggregateRating|"review"|"address"|"Event"/);
  }
});

test("pricing rules are stated wherever prices or the request button appear", async ({ page }) => {
  for (const path of PRICED) {
    await page.goto(path);
    const notice = page.getByTestId("pricing-notice").first();
    await expect(notice, path).toContainText("not the final price");
    await expect(notice, path).toContainText("Event Access is the fee we charge");
    await expect(notice, path).toContainText("Not a booking");
  }
  await page.goto("/rides/ferris-wheel-rental");
  await expect(page.locator("main")).not.toContainText(/Free to request|Cost to request/);
});
