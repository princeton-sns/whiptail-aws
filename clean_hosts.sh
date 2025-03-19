#!/bin/bash

if [ ! -f hosts.json ]; then
  echo "Error: hosts.json file not found!"
  exit 1
fi
# Extract server names from hosts.json using jq
SERVERS=$(jq -r '.[]' hosts.json)

echo '' > ~/.ssh/known_hosts

# Loop through each server and copy the private key
for server in $SERVERS; do
  echo "Cleaning on server $server..."

  ssh "$server" "echo '' > ~/.ssh/know_hosts"
  if [ $? -eq 0 ]; then
    echo "File cleaning successfully set on $server."
  else
    echo "Failed to clean file permissions on $server!"
  fi
  echo "---------------------------------------"
done
echo "All tasks completed."