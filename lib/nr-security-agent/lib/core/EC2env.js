const axios = require('axios');
const lodash = require('lodash');
const EC2METADATAURL = 'http://169.254.169.254/latest/meta-data';
const INTERFACE_MACS = 'http://169.254.169.254/latest/meta-data/network/interfaces/macs/';
const INSTANCEIDURL = 'http://169.254.169.254/latest/meta-data/instance-id';
const INSTANCETYPEURL = 'http://169.254.169.254/latest/meta-data/instance-type';
const INSTANCEDETAILURL = 'http://169.254.169.254/latest/dynamic/instance-identity/document';
const PUBLICIPURL = 'https://checkip.amazonaws.com';
const LOCALIPURL = 'http://169.254.169.254/latest/meta-data/local-ipv4'

const logs = require('./logging');
const logger = logs.getLogger();

async function checkIfEC2InstaceorNOT() {
    let flag = false;
    try {
        const response = await axios.get(EC2METADATAURL, { timeout: 5000 });
        if (response.status == 200) {
            flag = true;
        }
    } catch (error) {
        logger.error("Error is:", error);
        return false;
    }
    return flag;

}

async function getNetworkInterface() {
    try {
        const response = await axios.get(INTERFACE_MACS, {
            responseType: 'json'
        });
        const networkInterfaces = response.data;
        logger.debug(networkInterfaces); // Print the network interface details
        const networkData = await getDetailsOfNetworkInterface(networkInterfaces);
        return networkData;
    } catch (error) {
      logger.error("Error is:", error);
    }


}

async function getDetailsOfNetworkInterface(networkInterface) {
    try {
        const rootNetworkInterfaceURL = INTERFACE_MACS + networkInterface

        let dataObject = await genericRequestFire(rootNetworkInterfaceURL);
        let network = {
            macs: [dataObject]
        }
        return network;

    } catch (error) {
        logger.error(error);
    }

}

async function fireRequest(url) {
    const response = await axios.get(url);
    return response.data;
}

async function genericRequestFire(url) {
    const response = await axios.get(url);
    constInterfaceEndpoints = response.data.split('\n');
    let object = Object.assign({});
    for (let index = 0; index < constInterfaceEndpoints.length; index++) {
        const element = constInterfaceEndpoints[index];
        const data = await fireRequest(url + element);
        logger.debug("element data is:", lodash.camelCase(element), data);
        object[lodash.camelCase(element)] = data;
    }
    return object;

}


async function collectEnvInfo() {
    const isRunningInsideEC2 = await checkIfEC2InstaceorNOT();
    let envInfo = Object.assign({});
    if (isRunningInsideEC2) {

        const instanceId = await fireRequest(INSTANCEIDURL);
        const instanceType = await fireRequest(INSTANCETYPEURL);
        const networkData = await getNetworkInterface();
        const instaceIdentity = await fireRequest(INSTANCEDETAILURL);
        const publicIp = await fireRequest(PUBLICIPURL);
        const localIP = await fireRequest(LOCALIPURL);
        Object.assign(envInfo, instaceIdentity);

        envInfo.instanceId = instanceId;
        envInfo.instanceType = instanceType;
        envInfo.type = "EC2";
        envInfo.publicIpv4S = publicIp.trim();
        envInfo.localIpv4S = localIP;
        envInfo.arn = `arn:aws:ec2:${instaceIdentity.region}:${instaceIdentity.accountId}:instance/${instanceId}`
        envInfo.networkInterfaces = networkData;
        logger.debug("envInfo:", JSON.stringify(envInfo))
        return envInfo;
    }
    else{
        return {};
    }
    
}

// let collectedData = collectEnvInfo();
// collectedData.then((data) => {
//    console.log("collectedData is:", data)
// }).catch((err) => {
//     console.error(err);
// });

module.exports = {
    collectEnvInfo
}






