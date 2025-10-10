import { encodePayment } from "../evm/utils/paymentUtils";
import {
  AccountId,
  TokenId,
  Transaction,
  TransferTransaction,
  Hbar,
  TransactionId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId
} from "@hashgraph/sdk";
import { PaymentPayload, PaymentRequirements } from "../../../types/verify";
import { HederaSigner, serializeTransaction } from "../../../shared/hedera";

/**
 * Creates and encodes a payment header for the given client and payment requirements.
 *
 * @param client - The Hedera signer instance used to create the payment header
 * @param x402Version - The version of the X402 protocol to use
 * @param paymentRequirements - The payment requirements containing scheme and network information
 * @returns A promise that resolves to a base64 encoded payment header string
 */
export async function createPaymentHeader(
  client: HederaSigner,
  x402Version: number,
  paymentRequirements: PaymentRequirements,
): Promise<string> {
  const paymentPayload = await createAndSignPayment(client, x402Version, paymentRequirements);
  return encodePayment(paymentPayload);
}

/**
 * Creates and signs a payment for the given client and payment requirements.
 *
 * @param client - The Hedera signer instance used to create and sign the payment tx
 * @param x402Version - The version of the X402 protocol to use
 * @param paymentRequirements - The payment requirements
 * @returns A promise that resolves to a payment payload containing a base64 encoded Hedera transaction
 */
export async function createAndSignPayment(
  client: HederaSigner,
  x402Version: number,
  paymentRequirements: PaymentRequirements,
): Promise<PaymentPayload> {
  const transaction = await createTransferTransaction(client, paymentRequirements);
  const signedTransaction = await transaction.sign(client.privateKey);
  const base64EncodedTransaction = serializeTransaction(signedTransaction);

  // return payment payload
  return {
    scheme: paymentRequirements.scheme,
    network: paymentRequirements.network,
    x402Version: x402Version,
    payload: {
      transaction: base64EncodedTransaction,
    },
  } as PaymentPayload;
}

/**
 * Creates a transfer transaction for the given client and payment requirements.
 *
 * @param client - The Hedera signer instance used to create the transfer transaction
 * @param paymentRequirements - The payment requirements
 * @returns A promise that resolves to the transaction with the transfer instruction
 */
async function createTransferTransaction(
  client: HederaSigner,
  paymentRequirements: PaymentRequirements,
): Promise<Transaction> {
  // Get facilitator's account ID from payment requirements
  const facilitatorAccountIdStr = paymentRequirements.extra?.feePayer as string;
  if (!facilitatorAccountIdStr) {
    throw new Error("feePayer is required in paymentRequirements.extra");
  }
  const facilitatorAccountId = AccountId.fromString(facilitatorAccountIdStr);

  // Check if this is a token transfer or HBAR transfer
  if (isHbarAddress(paymentRequirements.asset)) {
    return createHbarTransferTransaction(client, facilitatorAccountId, paymentRequirements);
  } else {
    return createTokenTransferTransaction(client, facilitatorAccountId, paymentRequirements);
  }
}

function createHbarTransferTransaction(
  client: HederaSigner,
  facilitatorAccountId: AccountId,
  paymentRequirements: PaymentRequirements,
): TransferTransaction {
  const transactionId = TransactionId.generate(facilitatorAccountId);
  const fromAccount = client.accountId;
  const toAccount = AccountId.fromString(paymentRequirements.payTo);
  const amount = paymentRequirements.maxAmountRequired;

  // HBAR transfer - use TransferTransaction for native HBAR
  const transaction = new TransferTransaction()
    .setTransactionId(transactionId)
    .addHbarTransfer(fromAccount, Hbar.fromTinybars(-amount))
    .addHbarTransfer(toAccount, Hbar.fromTinybars(amount));

  return transaction.freezeWith(client.client);
}

function createTokenTransferTransaction(
  client: HederaSigner,
  facilitatorAccountId: AccountId,
  paymentRequirements: PaymentRequirements,
): TransferTransaction {
  const transactionId = TransactionId.generate(facilitatorAccountId);
  const fromAccount = client.accountId;
  const toAccount = AccountId.fromString(paymentRequirements.payTo);
  const amount = paymentRequirements.maxAmountRequired;
  const toTokenId = TokenId.fromString(paymentRequirements.asset);


  // HBAR transfer - use TransferTransaction for native HBAR
  const transaction = new TransferTransaction()
    .setTransactionId(transactionId)
    .addTokenTransfer(toTokenId, fromAccount, -parseInt(amount))
    .addTokenTransfer(toTokenId, toAccount, parseInt(amount));

  return transaction.freezeWith(client.client);
}

// async function createTokenTransferTransactionAsContractExecuteTransaction(
//   client: HederaSigner,
//   facilitatorAccountId: AccountId,
//   paymentRequirements: PaymentRequirements,
// ): Promise<ContractExecuteTransaction> {
//   const transactionId = TransactionId.generate(facilitatorAccountId);
//   const contractId = ContractId.fromString(paymentRequirements.asset);
//   const fromAccount = await populateEVMAddressForHederaAddress(client.client, client.accountId.toString());
//   const toAccount = await populateEVMAddressForHederaAddress(client.client, paymentRequirements.payTo);
//   const amount = paymentRequirements.maxAmountRequired;

//   const functionParameters = new ContractFunctionParameters()
//     .addAddress(fromAccount.toEvmAddress())
//     .addAddress(toAccount.toEvmAddress())
//     .addUint256(parseInt(amount));



//   const transaction = new ContractExecuteTransaction()
//     .setTransactionId(transactionId)
//     .setContractId(contractId)
//     .setFunction("transferFrom", functionParameters)
//     .setGas(100_000); // Set appropriate gas limit

//   return transaction.freezeWith(client.client);
// }

/**
 * Checks if the asset is HBAR (native currency)
 * HBAR is typically represented as "0.0.0" or "HBAR" in asset field
 * 
 * @param asset - The asset identifier
 * @returns True if the asset is HBAR
 */
function isHbarAddress(asset: string): boolean {
  return asset === "0.0.0" || asset.toLowerCase() === "hbar";
}