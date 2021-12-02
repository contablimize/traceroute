const raw = require('raw-socket');
const crypto = require('crypto');
const ip = require('ip');

class TCPClient extends raw.Socket {
    constructor(srcIp, srcPort, dstIp, dstPort) {
        super({
            protocol: raw.Protocol.TCP,
            addressFamily: raw.AddressFamily.IPv4
        });

        this.srcIp = srcIp;
        this.srcPort = srcPort;
        this.dstIp = dstIp;
        this.dstPort = dstPort;
    }

    synPacket() {
        // packet length 20 with SYN flag set, other flags are zeroed
        const packet = Buffer.from('0000000000000000000000005002000000000000', 'hex');
        
        packet.writeUInt16BE(this.srcPort, 0, 2);
        packet.writeUInt16BE(this.dstPort, 2, 2);

        // generate four random bytes for the packet sequence
        packet.writeUInt32BE(parseInt(Math.random()*0xffffffff), 4);
    
        // pseudo TCP header
        const pseudoHeader = Buffer.alloc(12);
        pseudoHeader.fill(0);
        pseudoHeader.writeUIntBE(ip.toLong(this.srcIp), 0, 4);
        pseudoHeader.writeUIntBE(ip.toLong(this.dstIp), 4, 4);
        pseudoHeader.writeUIntBE(6, 9, 1); // IP: protocol (ICMP=1, IGMP=2, TCP=6, UDP=17, static value)
        pseudoHeader.writeUIntBE(packet.length, 10, 2);
    
        // calculate checksum
        const checksum = raw.createChecksum(pseudoHeader, packet);
    
        // writing checksum to TCP packet.
        packet.writeUIntBE(checksum, 16, 2);
    
        return packet;
    }
}

module.exports = TCPClient;
