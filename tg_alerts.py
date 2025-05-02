#!/usr/bin/env python
# coding: utf-8

# #### **Import**

# In[1]:


import re
import os
import requests
import pandas as pd
import json
from pathlib import Path
from datetime import datetime, timedelta, timezone


# In[2]:


WSOL_MINT = "So11111111111111111111111111111111111111112"


# #### **Process:** Raydium

# In[3]:


logs_folder = Path('~/logs')
log_files = list(logs_folder.glob('stream_raydium_pools_*.log'))
if not log_files:
    raise FileNotFoundError("No .log files found in ./logs")
raydium_log = max(log_files, key=os.path.getmtime)
print(f"Parsing latest Raydium log file: {raydium_log.name}")


# In[5]:


with open(raydium_log, "r") as file:
    log_data = file.read()

pattern = re.compile(
    r"Timestamp \(UTC\): ([^\n]+).*?\{(.*?)\}", 
    re.DOTALL
)

entries = []

for match in pattern.finditer(log_data):
    timestamp = match.group(1).strip()
    json_str = "{" + match.group(2).strip() + "}"
    
    try:
        data = json.loads(json_str)
        data['timestamp'] = timestamp

        if data.get("pc_mint_address") == WSOL_MINT:
            data['initialSOLReserves'] = data.get('initPcAmount', 0) / 1e9
        else:
            data['initialSOLReserves'] = data.get('initCoinAmount', 0) / 1e9
        
        entries.append(data)
    except json.JSONDecodeError as e:
        print(f"Failed to parse JSON for timestamp {timestamp}: {e}")

# Create DataFrame
raydf = pd.DataFrame(entries)
raydf['timestamp'] = pd.to_datetime(raydf['timestamp'])
raydf = raydf.sort_values('timestamp').reset_index(drop=True)


# #### **Process:** PumpFun

# In[56]:


logs_folder = Path('~/logs')
log_files = list(logs_folder.glob('stream_pumpfun_pools_*.log'))
if not log_files:
    raise FileNotFoundError("No .log files found in ./logs")
pump_log = max(log_files, key=os.path.getmtime)
print(f"Parsing latest PumpFun log file: {pump_log.name}")


# In[54]:


# Regular expression to match the timestamp and signature
pattern = r"\[(.*?)\]\s*{\s*signature:\s*'([^']+)'"

# Read the file
with open(pump_log, 'r') as file:
    log_data = file.read()

# Find all matches
matches = re.findall(pattern, log_data)

# Create DataFrame
pumpdf = pd.DataFrame(matches, columns=['timestamp', 'signature'])

# Convert timestamp string to datetime
pumpdf['timestamp'] = pd.to_datetime(pumpdf['timestamp'])


# #### **Crunching**

# In[69]:


pump_count = len(pumpdf[pumpdf['timestamp'] >= (datetime.now(timezone.utc) - timedelta(hours=12))])


# In[7]:


ray_slice = raydf[raydf['timestamp'] >= (datetime.now(timezone.utc) - timedelta(hours=12))]


# In[11]:


ray_trade = len(ray_slice[ray_slice['initialSOLReserves'] >= 150])


# #### **Alerts**

# In[32]:


# Alertatron Webhook configure
webhook_url = "https://alertatron.com/webhook/incoming/9a5804fd-b16d-423b-a932-403cce5e59e3"


# In[83]:


# Build PumpSwap message
message = f"*PumpSwap: New Pools 12H* ~ [JLabs Digital](http://jlabsdigital.com/)\n"
message += "```\n"
message += f"New Pools: {pump_count}\n"
message += f"Tradeable Pools: {pump_count}\n"
message += "```\n"
message += "\n----\n"
message += "(Inbox)"

payload = {
    'text': message
}
response = requests.post(webhook_url, json=payload)

if response.status_code == 200:
    current_time = datetime.now().strftime('%H:%M')
    print(f"Telegram alert for PumpSwap sent successfully at {current_time}!")
else:
    print(f"Failed to send Telegram alert. Status code: {response.status_code}")
    print(response.text)


# In[82]:


# Build PumpSwap message
message = f"*Raydium: New Pools 12H* ~ [JLabs Digital](http://jlabsdigital.com/)\n"
message += "```\n"
message += f"New Pools: {len(ray_slice)}\n"
message += f"Tradeable Pools: {ray_trade}\n"
message += "```\n"
message += "\n----\n"
message += "(Inbox)"

payload = {
    'text': message
}
response = requests.post(webhook_url, json=payload)

if response.status_code == 200:
    current_time = datetime.now().strftime('%H:%M')
    print(f"Telegram alert for Raydium sent successfully at {current_time}!")
else:
    print(f"Failed to send Telegram alert. Status code: {response.status_code}")
    print(response.text)


# In[ ]:




