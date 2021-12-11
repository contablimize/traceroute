
import sys
import socket
import psutil
from pingserver import PingServer
from tcpclient import TCPClient


def getActiveNetworInterface(dstIp, dstPort):
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect((dstIp, dstPort))
    interfaceIp = s.getsockname()[0]

    interfaces = psutil.net_if_addrs()
    interfaceName = [i for i in interfaces for j in interfaces[i] if j.address==interfaceIp and j.family==socket.AF_INET][0]

    return interfaceName, interfaceIp


def groupByAddress(responses):
    byAddress = {}

    for response in responses:
        if response:
            if response['address'] in byAddress:
                byAddress[response['address']].append(response['time'])
            else:
                byAddress[response['address']] = [response['time']]

    return byAddress


def reverseLookup(address):
    try:
        name, alias, addressList = socket.gethostbyaddr(address)
        return name
    except socket.herror:
        return address


def showHopResult(hop, icmpResponses, tcpResponses, resolveDomain):
    byAddress = {}

    if tcpResponses:
        byAddress = groupByAddress(tcpResponses)

    if not byAddress:
        byAddress = groupByAddress(icmpResponses)

    for address in byAddress:
        domain = address;
        
        if resolveDomain:
            domain = reverseLookup(address)

        print('{:2d}  {} ({})  {} ms'.format(hop, domain, address, ' ms  '.join(map('{0:.2f}'.format, byAddress[address]))))


def trace(dstIp, dstPort, timeout, maxHops, resolveDomain):
    interfaceName, srcIp = getActiveNetworInterface(dstIp, dstPort)
    srcPort = 31234

    client = TCPClient(srcIp, srcPort, dstIp, dstPort)
    buffer = client.synPacket()

    print('Selected device {}, address {}, port {:d} for outgoing packets'.format(interfaceName, srcIp, srcPort))
    print('Tracing the path to {} on TCP port {:d}, ${:d} hops max'.format(dstIp, dstPort, maxHops))

    for hop in range(1, maxHops + 1):
        icmpResponses = []
        tcpResponses = []
        icmpResponse = None

        for trip in range(0, 3):
            icmpResponse = PingServer.ping(dstIp, hop, timeout)
            icmpResponses.append(icmpResponse)
         
            if not icmpResponse or icmpResponse['address'] != dstIp:
                tcpResponses.append(PingServer.ping(dstIp, hop, timeout, client, buffer))

        showHopResult(hop, icmpResponses, tcpResponses, resolveDomain)

        if icmpResponse and icmpResponse['address'] == dstIp:
            break


args = sys.argv

if len(args) < 3:
    print('Usage: python tcptraceroute.py host port');
else:
    try:
        trace(args[1], int(args[2]), 5000, 30, False)
    except PermissionError:
        print('Got root?')
    except Exception as ex:
        print(ex)

# trace('8.8.8.8', 443, 5000, 30, True)
