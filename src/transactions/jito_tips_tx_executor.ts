import {
  BlockhashWithExpiryBlockHeight,
  Keypair,
  PublicKey,
  SystemProgram,
  Connection,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import axios from "axios";
import bs58 from "bs58";
import { Currency, CurrencyAmount } from "@raydium-io/raydium-sdk";
import { connection } from "../helpers/config";

/**
 * The list of validators for the Jito network.
 */
const jito_Validators = [
  "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
  "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
  "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
  "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
  "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",             // louzy, but once in a while
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
  "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
  "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",             // louzy, but once in a while
];

const endpoints = [
  // TODO: Choose a jito endpoint which is closest to your location, and uncomment others
  "https://mainnet.block-engine.jito.wtf/api/v1/bundles",
  // "https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/bundles",
  "https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles",
  // "https://ny.mainnet.block-engine.jito.wtf/api/v1/bundles",
  // "https://tokyo.mainnet.block-engine.jito.wtf/api/v1/bundles",
];

/**
 * Generates a random validator from the list of jito_Validators.
 * @returns {PublicKey} A new PublicKey representing the random validator.
 */
export async function getRandomValidator() {
  const res =
    jito_Validators[Math.floor(Math.random() * jito_Validators.length)];
  return new PublicKey(res);
}

/**
 * Confirms a transaction on the Solana blockchain.
 * @param {string} signature - The signature of the transaction.
 * @param {object} latestBlockhash - The latest blockhash information.
 * @returns {object} - An object containing the confirmation status and the transaction signature.
 */
export async function jito_confirm(signature: any, latestBlockhash: any) {
  console.log("Confirming the jito transaction...");
  const confirmation = await connection.confirmTransaction(
    {
      signature,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      blockhash: latestBlockhash.blockhash,
    },
    "confirmed"
  );
  return { confirmed: !confirmation.value.err, signature };
}

/**
 * Executes and confirms a Jito transaction.
 * @param {Transaction} transaction - The transaction to be executed and confirmed.
 * @param {Account} payer - The payer account for the transaction.
 * @param {Blockhash} lastestBlockhash - The latest blockhash.
 * @param {number} jitofee - The fee for the Jito transaction.
 * @returns {Promise<{ confirmed: boolean, signature: string | null }>} - A promise that resolves to an object containing the confirmation status and the transaction signature.
 */
export async function jito_executeAndConfirm(
  transaction: any,
  payer: Keypair,
  lastestBlockhash: any,
  jitofee: any
) {
  console.log("Executing transaction (jito)...");
  let jito_validator_wallet = await getRandomValidator(); // Choose a random validator
  console.log("Selected Jito Validator: ", jito_validator_wallet.toBase58());
  try {
    const fee = new CurrencyAmount(Currency.SOL, jitofee, false).raw.toNumber();  // Convert the fee to lamports
    console.log(`Jito Fee: ${fee / 10 ** 9} sol`);

    const jitoFee_message = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: lastestBlockhash.blockhash,
      instructions: [
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: jito_validator_wallet,
          lamports: fee,
        }),
      ],
    }).compileToV0Message();  // Compile the Jito fee transaction
    const jitoFee_transaction = new VersionedTransaction(jitoFee_message);  // Create the Jito fee transaction
    jitoFee_transaction.sign([payer]);  //  Sign the Jito fee transaction
    const jitoTxSignature = bs58.encode(jitoFee_transaction.signatures[0]); //  Get the signature of the Jito fee transaction
    const serializedJitoFeeTransaction = bs58.encode(
      jitoFee_transaction.serialize()
    );  // Serialize the Jito fee transaction

    console.log("Transaction Explorer");
    console.log("http://solscan.io/tx/" + bs58.encode(transaction.signatures[0]));  // Print the transaction explorer link for OG Txn

    const serializedTransaction = bs58.encode(transaction.serialize()); // Serialize the original transaction
    const final_transaction = [
      serializedJitoFeeTransaction,
      serializedTransaction,
    ];  // Combine the Jito fee transaction and the original transaction

    const requests = endpoints.map((url) =>
      axios.post(url, {
        jsonrpc: "2.0",
        id: 1,
        method: "sendBundle",
        params: [final_transaction],
      })
    );  // Send the transaction to the Jito validators

    console.log("Sending tx to Jito validators...");
    const res = await Promise.all(requests.map((p) => p.catch((e) => e)));
    const success_res = res.filter((r) => !(r instanceof Error));
    if (success_res.length > 0) {
      console.log("Jito validator accepted the tx");
      return await jito_confirm(jitoTxSignature, lastestBlockhash);
    } else {
      console.log("No Jito validators accepted the tx");
      return { confirmed: false, signature: jitoTxSignature };
    }
  } catch (e) {
    if (e instanceof axios.AxiosError) {
      console.log("Failed to execute the jito transaction");
    } else {
      console.log("Error during jito transaction execution: ", e);
    }
    return { confirmed: false, signature: null };
  }
}