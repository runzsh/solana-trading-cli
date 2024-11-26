import { connection } from "../helpers/config";

/**
 * Executes a transaction and confirms it on the Solana blockchain.
 * @param {Transaction} transaction - The transaction to be executed.
 * @param {Account} payer - The account that will pay for the transaction fees.
 * @param {string} lastestBlockhash - The latest blockhash of the Solana blockchain.
 * @returns {Promise<boolean>} - A promise that resolves to true if the transaction is confirmed, false otherwise.
 */
export async function simple_executeAndConfirm(transaction:any, payer:any, lastestBlockhash:any) {
  console.log("Executing transaction...");
  const signature = await simple_execute(transaction);
  console.log("Transaction executed. Confirming transaction...");
  return simple_confirm(signature, lastestBlockhash);
}

async function simple_execute(transaction:any) {
  return connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: true,
    maxRetries: 0,
  });
}

// async function simple_confirm(signature:any, latestBlockhash:any) {
//   const confirmation = await connection.confirmTransaction(
//     {
//       signature,
//       lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
//       blockhash: latestBlockhash.blockhash,
//     },
//     connection.commitment
//   );
//   return { confirmed: !confirmation.value.err, signature };
// }

async function simple_confirm(signature: string, latestBlockhash: any) {
  const timeout = 30000; // 30 seconds timeout
  const pollInterval = 1000; // 1 second polling interval
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const status = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });

    if (status && status.value && status.value.confirmationStatus === connection.commitment) {
      return { confirmed: true, signature };
    }

    console.log("Waiting for confirmation...");
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  console.error("Transaction confirmation timed out");
  return { confirmed: false, signature };
}