import * as web3 from "@solana/web3.js"
import { 
    wallet, 
    jito_fee,
    alchemy_api_key
} from "../helpers/config";

const rpc = `https://solana-mainnet.g.alchemy.com/v2/${alchemy_api_key}`;
const connection = new web3.Connection(rpc, "confirmed");

async function main() {
    let slot = await connection.getSlot();
    console.log(`The latest slot number is: ${slot}`);
}

// main();