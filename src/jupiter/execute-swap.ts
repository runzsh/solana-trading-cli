import { swap } from "./swap/swap-helper";
import { logger } from "../helpers/logger";
import { program } from "commander";
import { PublicKey } from "@solana/web3.js";
import { connection, wallet } from "../helpers/config";
import { getSPLTokenBalance } from "../helpers";

let fromToken: string = "",
  toToken: string = "",
  percentage: number = 0,
  slippage: number = 0;

  program
  .option("--from <ADDRESS_TOKEN>", "Specify the address of the token you want to swap from")
  .option("--to <ADDRESS_TOKEN>", "Specify the address of the token you want to swap to")
  .option("--pct <PERCENTAGE_OF_BALANCE>", "Specify the percentage of balance to swap-out")
  .option("--slip <SLIPPAGE>", "Specify the slippage tolerance percentage", "1") // Default slippage to 1%
  .option("-h, --help", "display help for command")
  .action((options) => {
    if (options.help) {
      logger.info(
        "ts-node execute-swap.ts --from <ADDRESS_FROM_TOKEN> --to <ADDRESS_TO_TOKEN> --pct <PERCENTAGE_OF_BALANCE> --slip <SLIPPAGE>"
      );
      process.exit(0);
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
async function swap_cli(fromTokenAddress: string, toTokenAddress: string, pctBalance: number, slippageBps: number) {
    const balance = await getSPLTokenBalance(connection, new PublicKey(fromTokenAddress), wallet.publicKey);  
    await swap(fromTokenAddress, toTokenAddress, balance * pctBalance/100, slippageBps);
}

swap_cli(fromToken, toToken, percentage, slippage * 100);