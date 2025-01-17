import inquirer
import subprocess
import sys


def execute_ts_script(script_name, *args):
    """Helper function to execute the TypeScript script with arguments."""
    command = ["ts-node", script_name, *args]
    try:
        process = subprocess.run(
            command,
            stdout=sys.stdout,  # Direct stdout to the console
            stderr=sys.stderr,  # Direct stderr to the console
            text=True,
            check=False  # Avoid termination on errors
        )
        return process.returncode  # Return the exit code
    except Exception as e:
        print(f"\nAn error occurred: {e}")
        return None

def buy(token, sol, slip):
    print(f"Executing Buy Order...\nToken: {token}\nSOL: {sol}\nSlippage: {slip}%")
    return execute_ts_script("src/jupiter/buy.ts", "--token", token, "--sol", str(sol), "--slip", str(slip))

def sell(token, pct, slip):
    print(f"Executing Sell Order...\nToken: {token}\nPercentage: {pct}\nSlippage: {slip}%")
    return execute_ts_script("src/jupiter/sell.ts", "--token", token, "--pct", str(pct), "--slip", str(slip))

def swap(token_from, token_to, pct, slip):
    print(f"Executing Swap...\nFrom: {token_from}\nTo: {token_to}\nPercentage: {pct}\nSlippage: {slip}%")
    return execute_ts_script("src/jupiter/swapex.ts", "--from", token_from, "--to", token_to, "--pct", str(pct), "--slip", str(slip))

def account_balance():
    type = inquirer.list_input("Select:", choices=["SOL", "Token Mint Address"])
    if type == "Token Mint Address":
        token = inquirer.text("Enter token mint address:")
        print(f"Fetching...")
        return execute_ts_script("src/jupiter/balance.ts", "--token", token)
    
    print("Fetching account balance...")
    return execute_ts_script("src/jupiter/balance.ts", "--token", "So11111111111111111111111111111111111111112")

def main():
    print("Welcome to the Solana Trading CLI!")
    options = [
        "Buy",
        "Sell",
        "Swap",
        "Account Balance",
        "Exit"
    ]

    while True:
        print("\n")
        action = inquirer.list_input("Action:", choices=options)

        if action == "Buy":
            token = inquirer.text("Enter token address/symbol:")
            sol = inquirer.text("Enter SOL amount:")
            slip = inquirer.text("Enter slippage tolerance (percentage):")
            buy(token, sol, slip)
        elif action == "Sell":
            token = inquirer.text("Enter token address:")
            percentage = inquirer.text("Enter percentage of balance to sell:")
            slip = inquirer.text("Enter slippage tolerance (percentage):")
            sell(token, percentage, slip)
        elif action == "Swap":
            token_from = inquirer.text("Enter token to swap from:")
            token_to = inquirer.text("Enter token to swap to:")
            percentage = inquirer.text("Enter percentage of balance to swap:")
            slip = inquirer.text("Enter slippage tolerance (percentage):")
            swap(token_from, token_to, percentage, slip)
        elif action == "Account Balance":
            account_balance()
        elif action == "Exit":
            print("Goodbye!")
            sys.exit()

if __name__ == "__main__":
    main()