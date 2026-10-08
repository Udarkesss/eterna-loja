// EN: Quick M-Pesa check without opening the site. The phone receives a real PIN request.
// PT: Teste rápido do M-Pesa sem abrir o site. O telemóvel recebe um pedido de PIN verdadeiro.
//   node --env-file=.env.local scripts/test-mpesa.mjs 84XXXXXXX 10
// EN: "output_ResponseCode":"INS-0" = working. PT: "INS-0" = está a funcionar.

import { constants, publicEncrypt } from "node:crypto";

const [, , phoneArg, amount = "10"] = process.argv;
const { MPESA_API_KEY, MPESA_PUBLIC_KEY, MPESA_SERVICE_PROVIDER_CODE, MPESA_ENV } = process.env;

if (!MPESA_API_KEY || !MPESA_PUBLIC_KEY || !MPESA_SERVICE_PROVIDER_CODE) {
  console.error("Fill MPESA_API_KEY, MPESA_PUBLIC_KEY, MPESA_SERVICE_PROVIDER_CODE in .env.local / Preencher no .env.local");
  process.exit(1);
}

let msisdn = String(phoneArg ?? "").replace(/\D/g, "");
if (msisdn.length === 9) msisdn = `258${msisdn}`;
if (!/^2588[45]\d{7}$/.test(msisdn)) {
  console.error("Invalid M-Pesa number (84/85) / Número M-Pesa inválido. Ex.: scripts/test-mpesa.mjs 841234567 10");
  process.exit(1);
}

const body = MPESA_PUBLIC_KEY.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
const pem = `-----BEGIN PUBLIC KEY-----\n${body.match(/.{1,64}/g).join("\n")}\n-----END PUBLIC KEY-----\n`;
const token = publicEncrypt({ key: pem, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(MPESA_API_KEY)).toString("base64");
const host = process.env.MPESA_HOST || (MPESA_ENV === "production" ? "https://api.vm.co.mz" : "https://api.sandbox.vm.co.mz");
const ref = `TEST${Date.now().toString(36).toUpperCase()}`;

console.log(`${amount} MT → ${msisdn} (${host}). Confirm on the phone / Confirme no telemóvel…`);

const response = await fetch(`${host}:18352/ipg/v1x/c2bPayment/singleStage/`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    Origin: process.env.MPESA_ORIGIN || "developer.mpesa.vm.co.mz",
  },
  body: JSON.stringify({
    input_TransactionReference: ref,
    input_CustomerMSISDN: msisdn,
    input_Amount: String(amount),
    input_ThirdPartyReference: ref.slice(-12),
    input_ServiceProviderCode: MPESA_SERVICE_PROVIDER_CODE,
  }),
  signal: AbortSignal.timeout(90_000),
});

console.log("HTTP", response.status);
console.log(await response.text());
