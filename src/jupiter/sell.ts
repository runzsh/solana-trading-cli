import { logger } from "../helpers/logger";
import {sell} from "./swap"
import { program } from "commander";
import {getSPLTokenBalance} from "../helpers/check_balance"
import { connection, wallet } from "../helpers/config";
import { PublicKey } from "@solana/web3.js";

let token:string="",
  percentage:number=0,
  slippage:number=0;
program
  .option("--token <ADDRESS_TOKEN>", "Specify the token address")
  .option("--pct <SELL_PERCENTAGE>", "Specify the sell percentage")
  .option("--slip <SLIPPAGE>", "Specify the slippage tolerance percentage")
  .action((options) => {
    if (options.help) {
      logger.info(
        "ts-node sell.ts --token <ADDRESS_TOKEN> --pct <SELL_PERCENTAGE> --slip <SLIPPAGE>"
      );
      process.exit(0);
    }
    if (!options.token || !options.pct || !options.slip) {
      console.error("❌ Missing required options");
      process.exit(1);
    }
    token = options.token;
    percentage = options.pct;
    slippage = options.slip;
  });
program.parse();

/**
 * Sell function to perform a swap on the Meteora DEX.
 *
 * @param {string} side - The side of the trade (buy/sell).
 * @param {string} token_address - The address of the token to trade.
 * @param {number} sell_percentage - The sell percentage.
 * @param {number} slippage_bps - The slippage tolerance percentage.
 * @returns {Promise<void>} - A promise that resolves when the swap is completed.
 */
async function sell_cli(side:string, token_address:string, sell_percentage:number, slippage_bps:number) {
  const balance = await getSPLTokenBalance(connection, new PublicKey(token_address), wallet.publicKey);
  await sell(token_address, balance*sell_percentage/100, slippage_bps); // using 1% slippage
}
sell_cli("sell", token, percentage, slippage*100);
