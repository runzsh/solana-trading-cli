import { logger } from "../helpers/logger";
import { swap } from "./swap";
import { program } from "commander";
import {checkBalanceByAddress, getSPLTokenBalance} from "../helpers/check_balance"
import { connection, wallet } from "../helpers/config";
import { PublicKey } from "@solana/web3.js";
const wsol = "So11111111111111111111111111111111111111112";

let fromToken: string = "",
  toToken: string = "",
  percentage: number = 0,
  slippage: number = 0;
program
  .option("--from <ADDRESS_TOKEN>", "Specify the address of the token you want to swap from")
  .option("--to <ADDRESS_TOKEN>", "Specify the address of the token you want to swap to")
  .option("--pct <PERCENTAGE_OF_BALANCE>", "Specify the percentage of balance to swap-out")
  .option("--slip <SLIPPAGE>", "Specify the slippage tolerance percentage", "1") // Default slippage to 1%
  .action((options) => {
    if (options.help) {
      logger.info(
        "ts-node swapex.ts --from <ADDRESS_FROM_TOKEN> --to <ADDRESS_TO_TOKEN> --pct <PERCENTAGE_OF_BALANCE> --slip <SLIPPAGE>"
      );
      process.exit(0);
    }
    if (!options.from || !options.to || !options.pct) {
        console.error(
          `❌ Missing required options: ${
            !options.from ? "--from " : ""
          }${!options.to ? "--to " : ""}${!options.pct ? "--pct" : ""}`
        );
        process.exit(1);
    }
    fromToken = options.from;
    toToken = options.to;
    percentage = options.pct;
    slippage = options.slip;
  });
program.parse();

/**
 * Swap function to perform a token swap on Jupiter.
 *
 * @param {string} fromTokenAddress - The address of the token to swap from.
 * @param {string} toTokenAddress - The address of the token to swap to.
 * @param {number} pctBalance - The amount of Token to trade.
 * @param {number} slippageBps - The slippage tolerance percentage.
 * @returns {Promise<void>} - A promise that resolves when the swap is completed.
 */
async function swap_cli(
    fromTokenAddress: string, 
    toTokenAddress: string, 
    pctBalance: number, 
    slippageBps: number
) {
    let balanceToSwap;

    if (fromTokenAddress === wsol) {
        balanceToSwap = await checkBalanceByAddress(wallet.publicKey.toBase58(), connection);
    } else {
        balanceToSwap = await getSPLTokenBalance(connection, new PublicKey(fromTokenAddress), wallet.publicKey);
    }
    
    if (balanceToSwap !== undefined) {
        await swap(fromTokenAddress, toTokenAddress, balanceToSwap * pctBalance / 100, slippageBps);
    } else {
        console.error('Failed to retrieve balance to swap.');
    }
}
swap_cli(fromToken, toToken, percentage, slippage * 100);


// async function main() {
//   // Hardcoded arguments
//   const fromToken = "So11111111111111111111111111111111111111112"; // Replace with source token address
//   const toToken = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"; // Replace with destination token address
//   const percentage = 10; // Percentage of balance to swap
//   const slippage = 0.5 * 100; // Slippage tolerance (in basis points, 0.2% -> 20)

//   console.log('Starting swap operation...');
//   await swap_cli(fromToken, toToken, percentage, slippage);
// }
// main()