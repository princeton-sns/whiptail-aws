import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as route53 from 'aws-cdk-lib/aws-route53';

// import * as sqs from 'aws-cdk-lib/aws-sqs';
interface ClusterStackProps extends cdk.StackProps {
  /** Your public key string (e.g. "ssh-rsa AAAAB3Nza...") */
  publicKey: string;
  /** List of hostnames to assign to each EC2 instance */
  hostnames: string[];

  prefix: string;
}
export class WhiptilAwsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ClusterStackProps) {
    super(scope, id, props);

    const placementGroup = new ec2.PlacementGroup(
      this,
      `${props.prefix}-PlacementGroup`,
      {
        strategy: ec2.PlacementGroupStrategy.SPREAD,
      }
    );


    // Create a VPC limited to a single Availability Zone
    const vpc = new ec2.Vpc(this, `${props.prefix}-ClusterVPC`, {
      maxAzs: 1,
      subnetConfiguration: [
        {
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: "private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });


    // Create a Private Hosted Zone in Route53.
    const hostedZone = new route53.PrivateHostedZone(this, 'PrivateHostedZone', {
      zoneName: `${props.prefix}.whiptail.local`,
      vpc,
    });

    // Create a Security Group that allows inbound SSH (port 22) from anywhere
    const sshSg = new ec2.SecurityGroup(
      this,
      `${props.prefix}-SshSecurityGroup`,
      {
        vpc,
        description: "Allow SSH access from anywhere",
        allowAllOutbound: true,
      }
    );
    sshSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      "Allow SSH access from any IPv4"
    );

    const keyPair = new ec2.KeyPair(this, `${props.prefix}-KeyPair`, {
      publicKeyMaterial: props.publicKey,
    });

    // Look up the latest Ubuntu 22.04 LTS AMI
    const ubuntuAmi = ec2.MachineImage.genericLinux({
      "us-east-2": "ami-0884d2865dbe9de4b",
    });
    const instances: ec2.Instance[] = [];

    props.hostnames.forEach((hostname, index) => {
      // Create a user data script to set the hostname
      const userData = ec2.UserData.forLinux();
      userData.addCommands(
        `echo "Setting hostname to ${hostname}"`,
        `sudo hostnamectl set-hostname ${hostname}`,
        // Optionally update /etc/hosts to resolve the hostname locally
        `sudo sed -i "s/127.0.1.1.*/127.0.1.1 ${hostname}/" /etc/hosts`
      );

      const isControl = hostname === "control";
      const subnetSelection = isControl
        ? { subnetType: ec2.SubnetType.PUBLIC }
        : { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS };

      // Launch the EC2 instance with the user data
      const instance = new ec2.Instance(
        this,
        `${props.prefix}-Instance${index}`,
        {
          placementGroup,
          instanceType: ec2.InstanceType.of(
            ec2.InstanceClass.T3,
            ec2.InstanceSize.MICRO
          ),
          machineImage: ubuntuAmi,
          vpc,
          vpcSubnets: subnetSelection,
          securityGroup: sshSg,
          keyPair: keyPair,
          userData,
        }
      );

      instances.push(instance);
       // Create a DNS A record for the instance in the private hosted zone.
       new route53.ARecord(this, `${props.prefix}-ARecord${index}`, {
        zone: hostedZone,
        recordName: hostname, // e.g., control.example.internal
        target: route53.RecordTarget.fromIpAddresses(instance.instancePrivateIp),
      });

      if (isControl) {
        new cdk.CfnOutput(this, "ControlInstancePublicIP", {
          value: instance.instancePublicIp,
          description: "The public IP of the control instance",
        });
      }


    });

  
  }
}
