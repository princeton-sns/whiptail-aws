# Prerequirements
1. Install `aws-cli` on your machine: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
2. Intall `cdk` on your machine: https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html
3. Configure `aws-cli`: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-quickstart.html

# Setup
0. Change the `config.json`
1. Run `npm install` in this project
2. Run `cdk synth`
3. Run `cdk deploy` to deploy all your resources
4. If you want to delete the cluster, run `cdk destroy`

# Network
Servers have hostname like `server-${shard}-${replica}.${prefix}.whiptail.local`
Clients have hostname like `client-${index}-0.${prefix}.whiptail.local`
Control node has hostname  `control.${prefix}.whiptail.local`