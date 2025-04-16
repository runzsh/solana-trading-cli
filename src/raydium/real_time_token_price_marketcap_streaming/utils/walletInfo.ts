import { Connection, PublicKey } from "@solana/web3.js";
import { shyft_api_key } from "../../../helpers/config";
 
 const api = shyft_api_key
const connection = new Connection(`https://rpc.shyft.to?api_key=${api}`, 'confirmed');

export async function getTokenBalance(address){
    const account = await connection.getTokenAccountBalance(new PublicKey(address))
    const balance = Number(account.value.amount);
    return balance;
 }
 export async function getSolBalance(address){
     const account = await connection.getBalance(new PublicKey(address));
     const balance = account/1000000000;
    return balance;
 }  
