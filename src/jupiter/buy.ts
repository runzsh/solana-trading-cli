import { logger } from "../helpers/logger";
import { program } from "commander";
import { buy } from "./swap";
import { wallet } from "../helpers/config";
import { sl } from "../trading_dev/ProfitAndLoss";
import { sleepTime } from "../helpers";

let token: string = "",
  sol: number = 0,
  slippage: number = 0;

  program
  .option("--token <ADDRESS_TOKEN>", "Specify the token address")
  .option("--sol <NUMBER_OF_SOL>", "Specify the number of SOL")
  .option("--slip <SLIPPAGE>", "Specify the slippage tolerance percentage")
  .option("-h, --help", "display help for command")
  .action((options) => {
    if (options.help) {
      logger.info(
        "ts-node buy.ts --token <ADDRESS_TOKEN> --sol <NUMBER_OF_SOL> --slip <SLIPPAGE>"
      );
      process.exit(0);
    }
    if (!options.token || !options.sol) {
      console.error("❌ Missing required options");
      process.exit(1);
    }
    token = options.token;
    sol = options.sol;
    slippage = options.slip;
  });
program.parse();

/**
 * Buy function to perform a swap on Jupiter.
 *
 * @param {string} side - The side of the trade (buy/sell).
 * @param {string} token_address - The address of the token to trade.
 * @param {number} no_of_sol - The amount of SOL to trade.
 * @param {number} slippage_bps - The slippage tolerance percentage.
 * @returns {Promise<void>} - A promise that resolves when the swap is completed.
 */
async function buy_cli(side:string, token_address:string, no_of_sol:number, slippage_bps:number) {
  await buy(token_address, no_of_sol, slippage_bps);
}
buy_cli("buy", token, sol, slippage*100);
