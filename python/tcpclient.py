
import socket
import struct

class TCPClient(socket.socket):
    def __init__(self, srcIp, srcPort, dstIp, dstPort):
        socket.socket.__init__(self, socket.AF_INET, socket.SOCK_RAW, socket.IPPROTO_TCP)

        self.srcIp = srcIp
        self.srcPort = srcPort
        self.dstIp = dstIp
        self.dstPort = dstPort

    def synPacket(self):
        # packet length 20 with SYN flag set, other flags are zeroed
        packet =  bytearray(b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x50\x02\x00\x00\x00\x00\x00\x00')
        
        struct.pack_into('!H', packet, 0, self.srcPort)
        struct.pack_into('!H', packet, 2, self.dstPort)
    
        # pseudo TCP header
        pseudoHeader = bytearray(b'\x00' * 12)
        struct.pack_into('!I', pseudoHeader, 0, struct.unpack('!I', socket.inet_aton(self.srcIp))[0])
        struct.pack_into('!I', pseudoHeader, 4, struct.unpack('!I', socket.inet_aton(self.dstIp))[0])
        struct.pack_into('!b', pseudoHeader, 9, 6)
        struct.pack_into('!H', pseudoHeader, 10, len(packet))
            
        # calculate checksum
        checksum = TCPClient.__checksum(pseudoHeader, packet)
        # writing checksum to TCP packet.
        struct.pack_into('!H', packet, 16, checksum)
    
        return packet;

    @staticmethod
    def __checksum(header, data):
        sum = 0
        combined = header + data + b'\x00'

        for i in range(0, len(combined) - 1, 2):
            sum += (combined[i] << 8) + combined[i + 1]
            sum  = (sum & 0xffff) + (sum >> 16)

        sum = ~sum & 0xffff
        return sum
