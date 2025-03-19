#!/bin/bash
# copy_key.sh
# This script copies the local ~/.ssh/id_rsa file to each server listed in hosts.json
# and sets the file permission to 600 on the remote server.
# Check if hosts.json exists
if [ ! -f hosts.json ]; then
  echo "Error: hosts.json file not found!"
  exit 1
fi
# Extract server names from hosts.json using jq
SERVERS=$(jq -r '.[]' hosts.json)
# Check if the local private key exists
if [ ! -f ~/.ssh/id_rsa ]; then
  echo "Error: ~/.ssh/id_rsa file not found!"
  exit 1
fi
# Loop through each server and copy the private key
for server in $SERVERS; do
  echo "Copying ~/.ssh/id_rsa to server $server..."
  # Use scp to copy id_rsa to the remote server's ~/.ssh/ directory
  scp ~/.ssh/id_rsa "$server:~/.ssh/id_rsa"
  if [ $? -ne 0 ]; then
    echo "Failed to copy to $server!"
    continue
  fi
  echo "Setting file permission to 600 on $server..."
  # Use ssh to set the file permission on the remote server
  ssh "$server" "chmod 600 ~/.ssh/id_rsa"
  if [ $? -eq 0 ]; then
    echo "File permissions successfully set on $server."
  else
    echo "Failed to set file permissions on $server!"
  fi
  echo "---------------------------------------"
done
echo "All tasks completed."