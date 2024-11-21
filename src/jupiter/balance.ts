import { logger } from "../helpers/logger";
import { program } from "commander";
import {checkBalanceByAddress, getSPLTokenBalance} from "../helpers/check_balance"
import { connection, wallet } from "../helpers/config";
import { PublicKey } from "@solana/web3.js";
const wsol = "So11111111111111111111111111111111111111112";

let token: string = "";
program
    .option("--token <Token Address>", "Specify the address of the token you want to check balance for")
    .action((options) => {
        if (options.help) {
        logger.info(
            "ts-node balance.ts --token <TOKEN_ADDRESS>"
        );
        process.exit(0);
        }
        if (!options.token) {
            console.error(
            `❌ Missing required options: ${
                !options.token ? "--token" : ""
            }`
            );
            process.exit(1);
        }
        token = options.token;
    });
program.parse();

/**
 * Check balance of a token address.
 *
 * @param {string} tokenAddress - The address of the token to check balance for.
 * @returns {Promise<void>} - A promise that resolves when the balance is checked.
 */
async function fetch_balance(tokenAddress: string) {
    let balanceToCheck;

    if (tokenAddress === wsol) {
        balanceToCheck = await checkBalanceByAddress(wallet.publicKey.toBase58(), connection);
    } else {
        balanceToCheck = await getSPLTokenBalance(connection, new PublicKey(tokenAddress), wallet.publicKey);
    }
    return balanceToCheck;
}
fetch_balance(token);


// async function main() {
//     const token = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
//     console.log("Checking balance...");
//     await fetch_balance(token);
// }
// main();