
const raw = require('raw-socket');

const Messages = {
    ECHO_REPLY: 0,
    SOURCE_QUENCH: 3,
    REDIRECT_MESSAGE: 5,
    ECHO_REQUEST: 8,
    ROUTER_ADVERTISEMENT: 9,
    ROUTER_SOLICITATION: 10,
    TIME_EXCEEDED: 11,
    PARAMETER_PROBLEM: 12,
    TIMESTAMP: 13,
    TIMESTAMP_REPLY: 14,
    INFORMATION_REQUEST: 15,
    INFORMATION_REPLY: 16,
    ADDRESS_MASK_REQUEST: 17,
    ADDRESS_MASK_REPLY: 18,
    TRACEROUTE: 30,
    EXTENDED_ECHO_REQUEST: 42,
    EXTENDED_ECH_REPLY: 43
};

class Packet {
    constructor(type, code) {
        this.type = type;

        if (code) {
            this.code = code;
        } else {
            this.code = 0;
        }
    }

    toBuffer() {
        const buffer = Buffer.alloc(12);
        buffer.writeUInt8(this.type, 0);
        buffer.writeUInt8(this.code, 1);
        // ID
        buffer.writeUInt16BE(process.pid, 4);
        // sequence 6, 7
        // data 8, 9, 10, 11
        const checksum = raw.createChecksum(buffer);
        buffer.writeUInt16BE(checksum, 2);
        return buffer;
    }

    static fromBuffer(buffer, offset) {
        const type = buffer.readUInt8(offset);
        const code = buffer.readUInt8(offset + 1);
        // const id = buffer.readUInt16BE(offset + 4);
        // const sequence = buffer.readUInt16BE(offset + 6);

        return new Packet(type, code);
    }
};

class PingServer {
    static ping(destination, ttl, timeout, client, buffer) {
        return new Promise((resolve, reject) => {
            let start;
            const socket = raw.createSocket({
                protocol: raw.Protocol.ICMP,
                addressFamily: raw.AddressFamily.IPv4
            });
            const timer = setTimeout(() => {
                socket.close();
                resolve();
            }, timeout);
    
            client = client ? client : socket;
            buffer = buffer ? buffer : new Packet(Messages.ECHO_REQUEST).toBuffer();;

            socket.on('message', function(buffer, address) {
                const end = process.hrtime.bigint();
                const response = Packet.fromBuffer(buffer, 20, address);
                const responseTime = Math.round(Number(end - start) / 1000) / 1000;
                // const request = Packet.fromBuffer(buffer, 48);

                clearTimeout(timer);
                socket.close();
                resolve({
                    // "request": request,
                    "response": response,
                    "address": address,
                    "time": responseTime
                });
            });
    
            client.send(buffer, 0, buffer.length, destination,
                function () {
                    if (ttl)
                        client.setOption(raw.SocketLevel.IPPROTO_IP, raw.SocketOption.IP_TTL, ttl);
        
                    start = process.hrtime.bigint();
                },
                function(error, bytes) {
                    if (error) {
                        clearTimeout(timer);
                        socket.close();
                        reject(error.toString());
                    } 
                }
            );
        });
    }
};

module.exports = PingServer;