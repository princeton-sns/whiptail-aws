#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { WhiptilAwsStack } from '../lib/whiptil-aws-stack';
import * as fs from 'fs';
import * as path from 'path';
import * as ec2 from "aws-cdk-lib/aws-ec2";

const app = new cdk.App();
const configFilePath = path.join(__dirname, '..', 'config.json');
const configFile = fs.readFileSync(configFilePath, 'utf-8');
const { shard, client, prefix, publicKey } = JSON.parse(configFile);

if (prefix.trim() === '') {
  throw new Error('Prefix cannot be blank');
}

if (publicKey.trim() === '') {
  throw new Error('Public key cannot be blank');
}


new WhiptilAwsStack(app, `${prefix}-WhiptilAwsStack`, {
  prefix: prefix,
  publicKey: publicKey,
  shardConfig: shard,
  clientConfig: client,
  instanceClass: ec2.InstanceClass.C7I,
  instanceSize: ec2.InstanceSize.LARGE,
});