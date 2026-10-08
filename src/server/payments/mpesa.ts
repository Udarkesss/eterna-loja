import "server-only";
import { constants, publicEncrypt } from "node:crypto";
import { after } from "next/server";
import { AppError } from "../errors";
import { settlePayment } from "../orders";
import type { ChargeResult, PaymentGateway, StatusResult } from "./gateway";

/**
 * EN: Vodacom M-Pesa (84/85) — C2B single stage + Query Transaction Status.
 *     Docs: https://developer.mpesa.vm.co.mz (APIs tab).
 *     The C2B call only answers after the customer types her PIN (up to ~90 s), so it runs in the
 *     background: charge() returns "pending" at once, the checkout shows "Confirme no seu telemóvel",
 *     and the answer settles the order. If the answer never arrives, checkStatus() asks Vodacom.
 * PT: M-Pesa da Vodacom (84/85) — C2B de uma etapa + consulta do estado da transacção.
 *     O pedido C2B só responde depois de a cliente pôr o PIN (até ~90 s), por isso corre em segundo plano:
 *     charge() devolve logo "pending", o checkout mostra "Confirme no seu telemóvel" e a resposta fecha a
 *     encomenda. Se a resposta nunca chegar, checkStatus() pergunta à Vodacom.
 *
 * EN: Works on a Node server and on Vercel (after() + status query as a safety net).
 * PT: Funciona num servidor Node e na Vercel (after() + consulta de estado como rede de segurança).
 */

const HOSTS = {
  sandbox: "https://api.sandbox.vm.co.mz",
  production: "https://api.vm.co.mz",
} as const;

const C2B = { port: 18352, path: "/ipg/v1x/c2bPayment/singleStage/" };
const QUERY = { port: 18353, path: "/ipg/v1x/queryTransactionStatus/" };

// EN: Below the checkout's 90 s countdown, so the answer lands before the order expires.
// PT: Abaixo da contagem de 90 s do checkout, para a resposta chegar antes de a encomenda expirar.
const C2B_TIMEOUT_MS = 85_000;
const QUERY_TIMEOUT_MS = 15_000;

// EN: Codes that do NOT settle the order: the real state is unknown, so we ask again later.
// PT: Códigos que NÃO fecham a encomenda: o estado real é desconhecido, pergunta-se mais tarde.
const UNKNOWN_CODES = new Set(["INS-10", "NO_ANSWER", "NETWORK_ERROR"]);

interface MpesaConfig {
  apiKey: string;
  publicKey: string;
  serviceProviderCode: string;
  host: string;
  origin: string;
}

function readConfig(): MpesaConfig {
  const apiKey = process.env.MPESA_API_KEY;
  const publicKey = process.env.MPESA_PUBLIC_KEY;
  const serviceProviderCode = process.env.MPESA_SERVICE_PROVIDER_CODE;
  if (!apiKey || !publicKey || !serviceProviderCode) {
    // EN: The message stays in the server log; the customer sees the generic failure screen.
    // PT: A mensagem fica no registo do servidor; a cliente vê o ecrã genérico de falha.
    throw new AppError("PAYMENT_ERROR", "M-Pesa not configured: fill MPESA_* in .env.local", 501);
  }
  const env = process.env.MPESA_ENV === "production" ? "production" : "sandbox";
  return {
    apiKey,
    publicKey,
    serviceProviderCode,
    host: process.env.MPESA_HOST || HOSTS[env],
    origin: process.env.MPESA_ORIGIN || "developer.mpesa.vm.co.mz",
  };
}

/**
 * EN: Bearer token = API Key encrypted with Vodacom's public key (RSA PKCS#1 v1.5), Base64.
 * PT: Token = API Key cifrada com a chave pública da Vodacom (RSA PKCS#1 v1.5), em Base64.
 */
export function bearerToken(apiKey: string, publicKey: string): string {
  const body = publicKey.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const pem = `-----BEGIN PUBLIC KEY-----\n${(body.match(/.{1,64}/g) ?? []).join("\n")}\n-----END PUBLIC KEY-----\n`;
  return publicEncrypt({ key: pem, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(apiKey, "utf8")).toString("base64");
}

function headers(cfg: MpesaConfig) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${bearerToken(cfg.apiKey, cfg.publicKey)}`,
    Origin: cfg.origin,
  };
}

/** EN: "84 123 4567" → "258841234567". PT: Formato pedido pelo M-Pesa. */
function toMpesaMsisdn(msisdn: string): string {
  const digits = msisdn.replace(/\D/g, "");
  return digits.length === 9 ? `258${digits}` : digits;
}

/** EN: M-Pesa references: letters and digits only, ≤ 20. PT: Só letras e números, até 20. */
function compact(value: string, max = 20): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, max);
}

// EN: In-flight C2B requests of this server process, by our reference.
// PT: Pedidos C2B em curso neste processo do servidor, pela nossa referência.
type Flight = { done: false } | { done: true; result: StatusResult };
const flights = ((globalThis as { __eternaMpesaFlights?: Map<string, Flight> }).__eternaMpesaFlights ??=
  new Map<string, Flight>());

async function requestC2B(
  cfg: MpesaConfig,
  input: { transactionReference: string; thirdPartyReference: string; msisdn: string; amount: number },
): Promise<StatusResult> {
  try {
    const response = await fetch(`${cfg.host}:${C2B.port}${C2B.path}`, {
      method: "POST",
      headers: headers(cfg),
      body: JSON.stringify({
        input_TransactionReference: input.transactionReference,
        input_CustomerMSISDN: input.msisdn,
        input_Amount: String(Math.round(input.amount * 100) / 100),
        input_ThirdPartyReference: input.thirdPartyReference,
        input_ServiceProviderCode: cfg.serviceProviderCode,
      }),
      signal: AbortSignal.timeout(C2B_TIMEOUT_MS),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, string | undefined>;
    const code = body.output_ResponseCode ?? (response.status >= 500 ? "NO_ANSWER" : `HTTP-${response.status}`);
    console.info(`[mpesa] C2B ${input.thirdPartyReference}: ${code} ${body.output_ResponseDesc ?? ""}`);
    if (code === "INS-0") return { status: "paid", responseCode: code };
    return { status: UNKNOWN_CODES.has(code) ? "pending" : "failed", responseCode: code };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    console.warn(`[mpesa] C2B ${input.thirdPartyReference}: ${timedOut ? "no answer" : String(error)}`);
    return { status: "pending", responseCode: timedOut ? "NO_ANSWER" : "NETWORK_ERROR" };
  }
}

/**
 * EN: Query Transaction Status. `reference` is our third-party reference (accepted as input_QueryReference).
 * PT: Consulta do estado. `reference` é a nossa referência de terceiro (aceite como input_QueryReference).
 */
async function queryStatus(cfg: MpesaConfig, reference: string): Promise<StatusResult> {
  const params = new URLSearchParams({
    input_ThirdPartyReference: compact(`Q${Date.now().toString(36)}`),
    input_QueryReference: reference,
    input_ServiceProviderCode: cfg.serviceProviderCode,
  });
  try {
    const response = await fetch(`${cfg.host}:${QUERY.port}${QUERY.path}?${params}`, {
      method: "GET",
      headers: headers(cfg),
      signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, string | undefined>;
    const state = (body.output_ResponseTransactionStatus ?? "").toLowerCase();
    console.info(`[mpesa] query ${reference}: ${body.output_ResponseCode ?? response.status} ${state}`);
    if (body.output_ResponseCode !== "INS-0") return { status: "pending" };
    if (state.startsWith("complet")) return { status: "paid", responseCode: "INS-0" };
    if (/cancel|fail|expir|revers/.test(state)) return { status: "failed", responseCode: `QUERY-${state.toUpperCase()}` };
    return { status: "pending" };
  } catch {
    return { status: "pending" };
  }
}

export function createMpesaGateway(): PaymentGateway {
  return {
    method: "mpesa",

    async charge({ orderNumber, amount, msisdn, idempotencyKey }): Promise<ChargeResult> {
      if (!msisdn) throw new AppError("VALIDATION_ERROR", "M-Pesa needs a phone number", 400);
      const cfg = readConfig();
      // EN: One reference per order (idempotency key), so a retried request is spotted as a duplicate.
      // PT: Uma referência por encomenda (chave de idempotência): um pedido repetido é detectado como duplicado.
      const transactionReference = compact(orderNumber);
      const reference = compact(`${transactionReference}${idempotencyKey}`);

      flights.set(reference, { done: false });
      const task = requestC2B(cfg, { transactionReference, thirdPartyReference: reference, msisdn: toMpesaMsisdn(msisdn), amount })
        .then(async (result) => {
          flights.set(reference, { done: true, result });
          // EN: Settle now, even if the customer closed the page. PT: Fecha já, mesmo que a cliente tenha fechado a página.
          if (result.status !== "pending") {
            await settlePayment({ reference }, result.status as "paid" | "failed", result.responseCode);
          }
        })
        .catch((error) => console.error("[mpesa] settle failed", error));
      // EN: Online (Vercel) after() keeps the function alive until the answer arrives (up to the function time limit);
      //     if it is cut earlier, checkStatus() asks Vodacom. PT: Online, after() mantém a função viva até à resposta;
      //     se for cortada antes, checkStatus() pergunta à Vodacom.
      try {
        after(() => task);
      } catch {
        void task; // EN: outside a request (scripts/tests). PT: fora de um pedido.
      }

      return { reference, status: "pending" };
    },

    async checkStatus(reference): Promise<StatusResult> {
      const flight = flights.get(reference);
      if (flight && !flight.done) return { status: "pending" }; // EN: waiting for the PIN. PT: à espera do PIN.
      if (flight?.done && flight.result.status !== "pending") return flight.result;
      // EN: No answer, or the server restarted: ask Vodacom. PT: Sem resposta, ou o servidor reiniciou: pergunta à Vodacom.
      return queryStatus(readConfig(), reference);
    },
  };
}
