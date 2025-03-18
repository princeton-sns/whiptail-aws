#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { WhiptilAwsStack } from '../lib/whiptil-aws-stack';

const app = new cdk.App();
const prefix = 'Han';

const config = {
  0:[0,1,2],
  1:[0],
  2:[0],
}
const client  = [0];

function convertConfigToHosts(config: any, client: number[]): string[]{
  const hosts: string[] = [];
  for (const shard in config){
    for (const host of config[shard]){
      hosts.push(`server-${shard}-${host}`);
    }
  }

  for (const host of client){
    hosts.push(`client-${host}`);
  }
  return hosts;
}

const hosts = convertConfigToHosts(config, client);
hosts.push('control');


new WhiptilAwsStack(app, `${prefix}-WhiptilAwsStack`, {
  prefix: prefix,
  publicKey: '<public key>',
  hostnames: hosts
});