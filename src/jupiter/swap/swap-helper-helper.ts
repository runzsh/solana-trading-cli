import {
  convertToInteger,
  getQuote,
  getSwapTransaction,
  finalizeTransaction,
} from "./swap-helper";
import { PublicKey } from "@solana/web3.js";
import { wallet } from "../../helpers/config";
import { getDecimals } from "../../helpers/util";

/**
 * Performs a token swap transaction.
 *
 * @param {string} tokenToSell - The token to sell.
 * @param {string} tokenToBuy - The token to buy.
 * @param {number} amountTokenOut - The amount of token to receive.
 * @param {number} slippage - The allowed slippage in basis points.
 * @returns {Promise<void>} - A promise that resolves when the swap transaction is completed.
 */
export async function swap(
  tokenToSell: string,
  tokenToBuy: string,
  amountTokenOut: number,
  slippage: any
) {
  try {
    const decimals = await getDecimals(new PublicKey(tokenToSell));
    const convertedAmountOfTokenOut = await convertToInteger(
      amountTokenOut,
      decimals
    );
    const quoteResponse = await getQuote(
      tokenToSell,
      tokenToBuy,
      convertedAmountOfTokenOut,
      slippage
    );
    const wallet_PubKey = wallet.publicKey.toBase58();
    const swapTransaction = await getSwapTransaction(
      quoteResponse,
      wallet_PubKey
    );
    const { confirmed, signature } = await finalizeTransaction(swapTransaction);
    if (confirmed) {
      console.log("http://solscan.io/tx/" + signature);
    } else {
      console.log("Transaction failed");
      console.log("retrying transaction...");
      await swap(tokenToSell, tokenToBuy, amountTokenOut, slippage);
    }
  } catch (error) {
    console.error(error);
  }
}

async function main() {
  const tokenToSell = "So11111111111111111111111111111111111111112"
  const tokenToBuy = "FQ1tyso61AH1tzodyJfSwmzsD3GToybbRNoZxUBz21p8";
  const amountOfTokenToSell = 0.01;
  const slippage = 20;
  await swap(tokenToSell, tokenToBuy, amountOfTokenToSell, slippage);
}

// main();