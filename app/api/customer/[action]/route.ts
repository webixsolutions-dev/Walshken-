import {
  changeCustomerPassword, changeCustomerProfile, customerFor, customerSignIn, customerSignOut, customerSignUp,
  customerToken, submitCustomerInquiry,
} from "@/lib/walshken/customer";
import { checkOrigin, database, fail, handleError, payload, pick } from "@/lib/walshken/server";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  try {
    checkOrigin(request);
    const action = pick((await params).action, ["sign-in", "sign-up", "sign-out", "request", "profile", "password"], "customer action");
    const db = database();
    const token = customerToken(request.headers.get("cookie"));
    if (action === "sign-out") return await customerSignOut(request, db, token);
    const data = await payload(request);
    if (action === "sign-up") return await customerSignUp(request, db, data);
    if (action === "sign-in") return await customerSignIn(request, db, data);
    const actor = await customerFor(db, token);
    if (!actor) return fail(401, "Sign in to your customer account.");
    if (action === "request") return await submitCustomerInquiry(request, db, actor, data);
    if (action === "profile") return await changeCustomerProfile(db, actor, data);
    return await changeCustomerPassword(request, db, actor, token, data);
  } catch (error) {
    return handleError(error);
  }
}
