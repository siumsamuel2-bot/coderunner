import crypto from "crypto";

const secret = "fd5c92881af802a1818721e4033f51f442f7bbb3e3ea95537a7fc71f90df8422";
const agentId = "192b5fc0-cafb-4ec2-8359-db0ddb85576d";
const companyId = "f8e468dd-8699-4bb8-bb31-d004080f4687";
const runId = crypto.randomUUID();

const header = { alg: "HS256", typ: "JWT" };
const now = Math.floor(Date.now() / 1000);
const payload = {
  sub: agentId,
  company_id: companyId,
  adapter_type: "openclaw_local",
  run_id: runId,
  iss: "paperclip",
  aud: "paperclip-api",
  iat: now,
  exp: now + 3600,
};

function b64url(obj) {
  const s = JSON.stringify(obj);
  return Buffer.from(s)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const signingInput = `${b64url(header)}.${b64url(payload)}`;
const sig = crypto
  .createHmac("sha256", secret)
  .update(signingInput)
  .digest("base64")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");

console.log(`${signingInput}.${sig}`);
