import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as route53 from "aws-cdk-lib/aws-route53";

// import * as sqs from 'aws-cdk-lib/aws-sqs';
type Shard = {
  [key: string]: number[];
};
interface ClusterStackProps extends cdk.StackProps {
  /** Your public key string (e.g. "ssh-rsa AAAAB3Nza...") */
  publicKey: string;
  /** List of hostnames to assign to each EC2 instance */
  shardConfig: Shard;
  clientConfig: number[];
  prefix: string;
  instanceClass: ec2.InstanceClass;
  instanceSize: ec2.InstanceSize;
}

export class WhiptilAwsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ClusterStackProps) {
    super(scope, id, props);

    const placementGroups: {
      [key: string]: ec2.PlacementGroup;
    } = {};

    Object.entries(props.shardConfig).forEach(([key, shard], index) => {
      const placementGroup = new ec2.PlacementGroup(
        this,
        `${props.prefix}-PlacementGroup-${key}`,
        {
          strategy: ec2.PlacementGroupStrategy.SPREAD,
          spreadLevel: ec2.PlacementGroupSpreadLevel.RACK,
        }
      );
      placementGroups[key] = placementGroup;
    });

    const clientPlacement = new ec2.PlacementGroup(
      this,
      `${props.prefix}-ClientPlacementGroup`,
      {
        strategy: ec2.PlacementGroupStrategy.SPREAD,
        spreadLevel: ec2.PlacementGroupSpreadLevel.RACK,
      }
    );

    // Create a VPC limited to a single Availability Zone
    const vpc = new ec2.Vpc(this, `${props.prefix}-ClusterVPC`, {
      maxAzs: 1,
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    // Create a Private Hosted Zone in Route53.
    const hostedZone = new route53.PrivateHostedZone(
      this,
      "PrivateHostedZone",
      {
        zoneName: `${props.prefix}.whiptail.local`,
        vpc,
      }
    );


    let dnsRecordIndex = 0;

    // Create a Security Group that allows inbound SSH (port 22) from anywhere
    const sg = new ec2.SecurityGroup(this, `${props.prefix}-SecurityGroup`, {
      vpc,
      description: "Allow SSH/IMCP access from anywhere",
      allowAllOutbound: true,
    });
    sg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      "Allow SSH access from any IPv4"
    );

    sg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow ICMP access from any IPv4"
    );

    sg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcpRange(7000, 9999),
      "Allow RPC"
    );

    const dhcpOptions = new ec2.CfnDHCPOptions(this, "MyDHCPOptions", {
      domainName: `${props.prefix}.whiptail.local`,
      domainNameServers: ["10.0.0.2"],
    });

    new ec2.CfnVPCDHCPOptionsAssociation(this, "DHCPOptionsAssociation", {
      vpcId: vpc.vpcId,
      dhcpOptionsId: dhcpOptions.ref,
    });

    const keyPair = new ec2.KeyPair(this, `${props.prefix}-KeyPair`, {
      publicKeyMaterial: props.publicKey,
    });

    // Look up the latest Ubuntu 22.04 LTS AMI
    const ubuntuAmi = ec2.MachineImage.genericLinux({
      "us-east-2": "ami-0b0b9bb191eb744a7",
    });

    function createEc2(
      scope: Construct,
      hostname: string,
      placement: ec2.PlacementGroup,
      isControl: boolean,
    ) {
      const userData = ec2.UserData.forLinux();
      userData.addCommands(
        `echo "Setting hostname to ${hostname}"`,
        `sudo hostnamectl set-hostname ${hostname}`,
        `echo '' > ~/.ssh/know_hosts `
        // Optionally update /etc/hosts to resolve the hostname locally
      );

      const instance = new ec2.Instance(
        scope,
    
        `${props.prefix}-${hostname}`,
        
        {
          
          placementGroup: placement,
          instanceType: ec2.InstanceType.of(
            props.instanceClass,
            props.instanceSize
          ),
          blockDevices: [
            {
              deviceName: "/dev/sda1",
              volume: ec2.BlockDeviceVolume.ebs(64, {
                deleteOnTermination: true,
              }),
            },
          ],
          machineImage: ubuntuAmi,
          vpc,
          vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
          associatePublicIpAddress: isControl,
          securityGroup: sg,
          keyPair: keyPair,
          userData,
        },
      );
   // Create a DNS A record for the instance in the private hosted zone.
      new route53.ARecord(scope, `${props.prefix}-ARecord${dnsRecordIndex++}`, {
        zone: hostedZone,
        recordName: hostname, // e.g., control.example.internal
        target: route53.RecordTarget.fromIpAddresses(
          instance.instancePrivateIp
        ),
      });

      return instance;
    }

    Object.entries(props.shardConfig).forEach(([shardId, replicas], index) => {
      replicas.forEach((replica, index) => {
        // Create a user data script to set the hostname
        // Launch the EC2 instance with the user data
        const hostname = `server-${shardId}-${replica}`;
        const placement = placementGroups[shardId];
        const instance = createEc2(
          this,
          hostname,
          placement,
          false
        );
      });
    });

    props.clientConfig.forEach((client, index) => {
      const hostname = `client-${client}-0`;
      const instance = createEc2(
        this,
        hostname,
        clientPlacement,
        false
      );
    
    });

    const controlInstance = createEc2(
      this,
      "control",
      placementGroups["control"],
      true
    );

    

    new cdk.CfnOutput(this, "ControlInstancePublicIP", {
      value: controlInstance.instancePublicIp,
      description: "The public IP of the control instance",
    });
  }
}
