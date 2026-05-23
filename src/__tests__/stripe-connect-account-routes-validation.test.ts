import { describe, expect, it } from "vitest";
import { POST as createAccountLink } from "@/app/api/stripe-connect-demo/sellers/[accountId]/account-link/route";
import { POST as openBillingPortal } from "@/app/api/stripe-connect-demo/sellers/[accountId]/billing-portal/route";
import {
  GET as listSellerProducts,
  POST as createSellerProduct,
} from "@/app/api/stripe-connect-demo/sellers/[accountId]/products/route";
import { GET as getSellerStatus } from "@/app/api/stripe-connect-demo/sellers/[accountId]/route";
import { POST as startSubscriptionCheckout } from "@/app/api/stripe-connect-demo/sellers/[accountId]/subscription/checkout/route";
import { POST as startStoreCheckout } from "@/app/api/stripe-connect-demo/store/[accountId]/checkout/route";

const INVALID_ACCOUNT_ID = "cus_not_a_connect_account";
const INVALID_JSON_RESPONSE = { error: "Invalid connected account id." };

type RouteContext = { params: Promise<{ accountId: string }> };

function invalidAccountContext(): RouteContext {
  return { params: Promise.resolve({ accountId: INVALID_ACCOUNT_ID }) };
}

async function expectInvalidAccountResponse(responsePromise: Promise<Response>) {
  const response = await responsePromise;
  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toEqual(INVALID_JSON_RESPONSE);
}

describe("stripe connect demo account routes", () => {
  it("rejects invalid account ids on seller status route", async () => {
    await expectInvalidAccountResponse(
      getSellerStatus(new Request("http://localhost/api/test"), invalidAccountContext()),
    );
  });

  it("rejects invalid account ids on seller products routes", async () => {
    await expectInvalidAccountResponse(
      listSellerProducts(new Request("http://localhost/api/test"), invalidAccountContext()),
    );

    await expectInvalidAccountResponse(
      createSellerProduct(
        new Request("http://localhost/api/test", { method: "POST" }),
        invalidAccountContext(),
      ),
    );
  });

  it("rejects invalid account ids on account-link route", async () => {
    await expectInvalidAccountResponse(
      createAccountLink(
        new Request("http://localhost/api/test", { method: "POST" }),
        invalidAccountContext(),
      ),
    );
  });

  it("rejects invalid account ids on billing-portal route", async () => {
    await expectInvalidAccountResponse(
      openBillingPortal(
        new Request("http://localhost/api/test", { method: "POST" }),
        invalidAccountContext(),
      ),
    );
  });

  it("rejects invalid account ids on subscription checkout route", async () => {
    await expectInvalidAccountResponse(
      startSubscriptionCheckout(
        new Request("http://localhost/api/test", { method: "POST" }),
        invalidAccountContext(),
      ),
    );
  });

  it("rejects invalid account ids on storefront checkout route", async () => {
    await expectInvalidAccountResponse(
      startStoreCheckout(
        new Request("http://localhost/api/test", { method: "POST" }),
        invalidAccountContext(),
      ),
    );
  });
});
