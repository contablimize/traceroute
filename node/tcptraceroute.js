
const PingServer = require('./ping-server');
const TCPClient = require('./tcp-client');
const network = require('network');
const portFinder = require('portfinder');
const dns = require('dns');

function getActiveNetworInterface() {
    return new Promise((resolve, reject) => {
        network.get_active_interface(function(error, active) {
            if (error) {
                reject(error);
            } else {
                resolve(active);
            }
        });
    });
}

function getUnusedPort() {
    return new Promise((resolve, reject) => {
        const minPort = 32 * 1024;
        const maxPort = 64 * 1024
        const randomStart = parseInt(Math.random() * (maxPort - minPort) + minPort);
        portFinder.getPort({port: randomStart, stopPort: maxPort}, function(error, srcPort) {
            if (error) {
                reject(error);
            } else {
                resolve(srcPort);
            }
        });
    });
}

function reverseLookup(ipAddress) {
    return new Promise((resolve, reject) => {
        dns.reverse(ipAddress, function(error, domains) {
            if (error) {
                if (error.code == dns.NOTFOUND) {
                    resolve(ipAddress);
                } else {
                    reject(error);
                }
            } else {
                resolve(domains[0]);
            }
        });
    });
}

function groupByAddress(responses) {
    let byAddress = {}

    for (let idx in responses) {
        if (responses[idx]) {
            if (responses[idx].address in byAddress) {
                byAddress[responses[idx].address].push(responses[idx].time);
            } else {
                byAddress[responses[idx].address] = [responses[idx].time];
            }
        }
    }

    return byAddress;
}

async function showHopResult(hop, icmpResponses, tcpResponses, resolveDomain) {
    let byAddress;

    if (tcpResponses && tcpResponses.length > 0) {
        byAddress = groupByAddress(tcpResponses);
    }

    if (!byAddress) {
        byAddress = groupByAddress(icmpResponses);
    }

    for (let address in byAddress) {
        let domain = address;
        
        if (resolveDomain) {
            domain = await reverseLookup(address);
        }
        console.log(hop.toString().padStart(2, ' '), '', domain, '(' + address + ') ', byAddress[address].join(' ms  '), 'ms');
    }
}

async function trace(dstIp, dstPort, timeout, maxHops, resolveDomain) {
    const activeInterface = await getActiveNetworInterface();
    const srcPort = await getUnusedPort();
    const srcIp = activeInterface.ip_address;

    const client = new TCPClient(srcIp, srcPort, dstIp, dstPort);
    const buffer = client.synPacket();

    console.log(`Selected device ${activeInterface.name}, address ${srcIp}, port ${srcPort} for outgoing packets`);
    console.log(`Tracing the path to ${dstIp} on TCP port ${dstPort}, ${maxHops} hops max`);

    for (let hop = 1; hop <= maxHops; hop = hop + 1) {
        let icmpResponses = [];
        let tcpResponses = [];
        let icmpResponse;

        for (let trip = 0; trip < 3; trip = trip + 1) {
            icmpResponse = await PingServer.ping(dstIp, hop, 5000);
            icmpResponses.push(icmpResponse);
         
            if (!icmpResponse || icmpResponse.address !== dstIp) {
                tcpResponses.push(await PingServer.ping(dstIp, hop, timeout, client, buffer));
            }
        }

        await showHopResult(hop, icmpResponses, tcpResponses, resolveDomain);

        if (icmpResponse && icmpResponse.address === dstIp) {
            break;
        }
    }

    client.close();
}

const args = process.argv.slice(2);

if (args.length < 2) {
    console.log('Usage: node tcptraceroute.js host port');
} else {
    try {
        trace(args[0], parseInt(args[1]), 5000, 30, true)
            .catch((error) => {
                if (error.toString().includes('Operation not permitted')) {
                    console.log('Got root?');
                } else {
                    console.log(error);
                }
            });
    }
    catch (error) {
    }
}
