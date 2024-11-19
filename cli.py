import inquirer
import subprocess
import sys



def execute_ts_script(script_name, *args):
    """Helper function to execute the TypeScript script with arguments."""
    command = ["ts-node", script_name, *args]
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        print(f"\n{result.stdout}")
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"\nError executing script: {e.stderr}")
        return None

def buy(token, sol, slip):
    print(f"Executing Buy Order...\nToken: {token}\nSOL: {sol}\nSlippage: {slip}%")
    return execute_ts_script("src/jupiter/buy.ts", "--token", token, "--sol", str(sol), "--slip", str(slip))

def sell(token, percentage, slip):
    print(f"Executing Sell Order...\nToken: {token}\nAmount: {percentage}\nSlippage: {slip}%")
    return execute_ts_script("src/jupiter/sell.ts", "--token", token, "--percentage", str(percentage), "--slip", str(slip))

def swap(token_from, token_to, amount, slip):
    print(f"Executing Swap...\nFrom: {token_from}\nTo: {token_to}\nAmount: {amount}\nSlippage: {slip}%")
    return execute_ts_script("src/jupiter/swap.ts", "--from", token_from, "--to", token_to, "--amount", str(amount), "--slip", str(slip))

def account_balance():
    print("Fetching account balance...")
    return execute_ts_script("src/jupiter/account_balance.ts")

def main():
    print("\nWelcome to the Solana Trading CLI!\n")
    options = [
        "Buy",
        "Sell",
        "Swap",
        "Account Balance",
        "Exit"
    ]

    while True:
        action = inquirer.list_input("What would you like to do?", choices=options)

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
            amount = inquirer.text("Enter amount to swap:")
            slip = inquirer.text("Enter slippage tolerance (percentage):")
            swap(token_from, token_to, amount, slip)
        elif action == "Account Balance":
            account_balance()
        elif action == "Exit":
            print("Goodbye!")
            sys.exit()

if __name__ == "__main__":
    main()